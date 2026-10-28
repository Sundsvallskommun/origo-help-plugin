import Origo from 'Origo';
import './scss/help-plugin.scss';
import './content/help.scss';

const fallbackLocaleId = 'sv-SE';

// Locale from file name, e.g. ./src/loc/sv_SE.json -> sv-SE and ./content/help.en_US.html -> en-US.
const localeIdFromPath = (path) => path.match(/([^/.]+)\.(json|html)$/)[1].replace('_', '-');

// Button text per language (src/loc/<language>.json).
const locales = Object.fromEntries(Object.entries(import.meta.glob('./src/loc/*.json', { eager: true, import: 'default' }))
  .map(([path, locale]) => [localeIdFromPath(path), locale]));

// The images in content/img are built into the plugin and replace src="img/..." in the help text.
const images = import.meta.glob('./content/img/*.png', { eager: true, query: '?url', import: 'default' });
const withImages = (html) => html.replace(/src="img\/([^"]+)"/g, (match, file) => {
  const src = images[`./content/img/${file}`];
  return src ? `src="${src}"` : match;
});

// Help text per language (content/help.<language>.html). Languages without their own help text get the Swedish one.
const builtInContent = Object.fromEntries(Object.entries(import.meta.glob('./content/help.*.html', { eager: true, query: '?raw', import: 'default' }))
  .map(([path, html]) => [localeIdFromPath(path), withImages(html)]));

// Picks the language closest to the map language: exact locale, otherwise the same language (e.g. en-GB -> en-US),
// otherwise Swedish.
function resolveLocaleId(localeId, available) {
  if (!localeId) return fallbackLocaleId;
  if (available.includes(localeId)) return localeId;
  const language = localeId.split('-')[0];
  return available.find((id) => id.split('-')[0] === language) || fallbackLocaleId;
}

const Help = function Help(options = {}) {
  const {
    icon = '#ic_help_outline_24px',
    width = '400px',
    height = '60vh',
    target,
    filterByControls = true,
    placement = ['menu']
  } = options;

  let mapMenu;
  let menuItem;
  let helpButton;
  let screenButtonContainer;
  let viewer;
  let panel;
  let frame;
  let localeId;
  let url;
  let buttonText;
  let title;

  // While dragging, pointer events are disabled on the iframe, otherwise the mouse "gets stuck" in the help page
  // and the panel stops following.
  function bindDragFix() {
    const panelEl = panel.getContentElement().parentElement;
    const header = panelEl.querySelector('.draggable');
    const startDrag = () => {
      panelEl.classList.add('o-help-dragging');
      const stopDrag = () => {
        panelEl.classList.remove('o-help-dragging');
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchend', stopDrag);
      };
      document.addEventListener('mouseup', stopDrag);
      document.addEventListener('touchend', stopDrag);
    };
    header.addEventListener('mousedown', startDrag);
    header.addEventListener('touchstart', startDrag);
  }

  // Gets the values of a setting. The path can go into objects and arrays with a dot,
  // e.g. links.url gives the url of each link. Always returns an array.
  function getOptionValues(controlOptions, path) {
    return path.split('.').reduce((values, key) => values
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .map((value) => value?.[key]), [controlOptions]);
  }

  // True if the map has a control matching the condition. The condition is a control name,
  // optionally with a requirement on a setting: name[setting=value] (for arrays: the array contains the value),
  // name[setting*=text] (the value contains the text), name[setting] (set to a truthy value)
  // or name[!setting] (not set or falsy).
  // The same control can appear several times with different settings (e.g. sharemap).
  function hasControl(condition) {
    const match = condition.match(/^([^[]+)(?:\[(!?)([^=\]*]+)(?:(\*?=)([^\]]*))?\])?$/);
    if (!match) return false;
    const [, name, not, option, operator, value] = match;
    return viewer.getComponents().some((component) => {
      if (component.name !== name) return false;
      if (!option) return true;
      const values = getOptionValues(component.options, option)
        .flatMap((optionValue) => (Array.isArray(optionValue) ? optionValue : [optionValue]));
      if (not) return !values.some(Boolean);
      if (!operator) return values.some(Boolean);
      if (operator === '*=') return values.some((optionValue) => optionValue != null && String(optionValue).includes(value));
      return values.some((optionValue) => optionValue != null && String(optionValue) === value);
    });
  }

  // Hides parts of the built-in help that belong to controls not present in the map.
  // data-help-control gives one or more conditions (space separated), it is enough that one of them is met.
  // data-help-element gives a css selector for an element (e.g. a button) that must exist in the map. Used
  // for plugins that don't expose their settings.
  function filterContent() {
    const mapEl = document.querySelector(viewer.getTarget()) || document;
    panel.getContentElement().querySelectorAll('[data-help-control], [data-help-element]').forEach((el) => {
      const { helpControl, helpElement } = el.dataset;
      const controlOk = !helpControl || helpControl.split(/\s+/).filter(Boolean).some(hasControl);
      const elementOk = !helpElement || Boolean(mapEl.querySelector(helpElement));
      el.toggleAttribute('hidden', !(controlOk && elementOk));
    });
  }

  function createPanel(parent) {
    panel = Origo.ui.FloatingPanel({
      viewer,
      type: 'floating',
      title,
      contentComponent: Origo.ui.Element({
        tagName: 'div',
        cls: url ? 'o-help-content' : 'o-help-content o-help-body',
        style: { width, height },
        innerHTML: url ? '<iframe class="o-help-frame"></iframe>' : builtInContent[resolveLocaleId(localeId, Object.keys(builtInContent))]
      })
    });
    // addComponent renders the panel in the map
    parent.addComponent(panel);
    // The toolbar button is shown as active (blue) while the panel is open, also when it is closed with the cross.
    if (helpButton) {
      panel.on('show', () => helpButton.setState('active'));
      panel.on('hide', () => helpButton.setState('initial'));
    }
    if (url) {
      frame = panel.getContentElement().querySelector('iframe');
      frame.title = title;
      frame.setAttribute('src', url);
      bindDragFix();
    }
  }

  // Shows the help in a movable panel on top of the map. Without url the built-in help text is shown,
  // with url that page is shown in the panel. If target is also given (e.g. '_blank'), url opens in a new window.
  function showHelp(parent) {
    if (url && target) {
      window.open(url, target);
      return;
    }
    if (!panel) createPanel(parent);
    // The controls are checked on every show since plugins can be added after the help.
    if (!url && filterByControls) filterContent();
    panel.show();
  }

  // The toolbar button opens the help and closes it again on the next click.
  function toggleHelp(parent) {
    if (panel?.getStatus()) {
      panel.hide();
    } else {
      showHelp(parent);
    }
  }

  return Origo.ui.Component({
    name: 'help',
    onAdd(evt) {
      const component = this;
      viewer = evt.target;
      // Origo reloads the page when the language changes, so the language only needs to be read here.
      const localization = viewer.getControlByName('localization');
      if (localization) {
        Object.entries(locales).forEach(([id, locale]) => localization.addPluginToLocale(id, locale));
        localeId = localization.getCurrentLocaleId();
      }
      const localize = (key) => localization?.getStringByKeys({ targetParentKey: 'help', targetKey: key })
        || locales[fallbackLocaleId].help[key];
      // url, buttonText and title can be a string or an object with one value per language,
      // e.g. { 'sv-SE': 'Hjälp', 'en-US': 'Help' }.
      const localized = (value) => (value && typeof value === 'object'
        ? value[resolveLocaleId(localeId, Object.keys(value))]
        : value);
      url = localized(options.url);
      buttonText = localized(options.buttonText) || localize('buttonText');
      title = localized(options.title) || buttonText;
      mapMenu = viewer.getControlByName('mapmenu');
      // Placement as in Origo's draw control: 'menu' (the map menu) and/or 'screen' (button in the map toolbar).
      // Without a map menu the button is shown in the toolbar instead.
      const places = Array.isArray(placement) ? placement : [placement];
      const inMenu = places.includes('menu') && Boolean(mapMenu);
      const onScreen = places.includes('screen') || (places.includes('menu') && !mapMenu);
      if (inMenu) {
        menuItem = mapMenu.MenuItem({
          click() {
            showHelp(component);
            mapMenu.close();
          },
          icon,
          title: buttonText
        });
        this.addComponent(menuItem);
      }
      if (onScreen) {
        screenButtonContainer = Origo.ui.Element({
          tagName: 'div',
          cls: 'flex column'
        });
        helpButton = Origo.ui.Button({
          cls: 'o-help-button padding-small margin-bottom-smaller icon-smaller round light box-shadow',
          click() {
            toggleHelp(component);
          },
          icon,
          tooltipText: buttonText,
          tooltipPlacement: 'east'
        });
        this.addComponent(helpButton);
      }
      this.render();
    },
    render() {
      if (helpButton) {
        const mapTools = viewer.getMain().getMapTools().getId();
        document.getElementById(mapTools).appendChild(Origo.ui.dom.html(screenButtonContainer.render()));
        document.getElementById(screenButtonContainer.getId()).appendChild(Origo.ui.dom.html(helpButton.render()));
      }
      if (menuItem) {
        mapMenu.appendMenuItem(menuItem);
      }
      this.dispatch('render');
    }
  });
};

export default Help;
