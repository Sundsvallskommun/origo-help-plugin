# Help plugin

An [Origo](https://github.com/origo-map/origo) plugin that adds a help link to the map menu (`mapmenu`). The help is shown in a movable Origo `FloatingPanel` on top of the map (drag the title bar). The help text is bundled with the plugin (`content/`), but you can also point to your own page with `url`. Requires an Origo version that includes `Origo.ui.FloatingPanel`. Where the button is placed is controlled with `placement`, in the same way as for Origo's draw control. If the map configuration has no map menu, a button is added to the map toolbar instead.

The structure follows [origo-map/barebone-plugin](https://github.com/origo-map/barebone-plugin), but the plugin is built with [Vite](https://vite.dev) instead of webpack.

## Options

| Option       | Description                                                                     | Default                  |
|--------------|---------------------------------------------------------------------------------|--------------------------|
| `url`        | Custom help page shown in the panel (iframe) instead of the built-in help. Can be an object with one url per language, e.g. `{ 'sv-SE': '...', 'en-US': '...' }` | –                        |
| `buttonText` | Text of the menu item/button                                                    | based on the map language, e.g. `'Help'` |
| `title`      | Title of the help panel. `url`, `buttonText` and `title` can be set per language, see [Localization](#localization) | same as `buttonText`     |
| `width`      | Panel width (css value)                                                         | `'400px'`                |
| `height`     | Panel height (css value)                                                        | `'60vh'`                 |
| `icon`       | Icon (reference to the Origo sprite)                                            | `'#ic_help_outline_24px'` |
| `target`     | Together with `url`: opens the page with `window.open(url, target)`, e.g. `'_blank'` | –                    |
| `placement`  | Where the button that opens the help is shown: `'menu'` (the map menu) and/or `'screen'` (button in the map toolbar), e.g. `['menu', 'screen']` | `['menu']` |
| `filterByControls` | Only show the parts of the built-in help that belong to controls present in the map | `true`       |

## Example

**index.html:**
```html
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Origo example</title>
  <link href="css/style.css" rel="stylesheet">
  <link href="plugins/help.css" rel="stylesheet">
</head>
<body>
  <div id="app-wrapper"></div>
  <script src="js/origo.js"></script>
  <script src="plugins/help.js"></script>

  <script type="text/javascript">
    var origo = Origo('index.json');
    origo.on('load', function (viewer) {
      var help = Help({
        placement: ['menu', 'screen']
      });
      viewer.addComponent(help);
    });
  </script>
</body>
```

## Development

Clone the plugin next to Origo so that the directory structure becomes:

```
origo/
origo-help-plugin/
```

```
npm install
npm start
```

`npm start` rebuilds the plugin on every change to `../origo/plugins/help.js` and `../origo/plugins/help.css`. Start Origo as usual (`npm start` in the origo directory) and include the files as in the example above.

## Build

```
npm run build
```

The output ends up in `build/js/help.min.js` and `build/css/help.css`.

## Localization

The plugin follows the language of Origo's `localization` control. The button text is in `src/loc/<language>.json` and is added to Origo's locales with `addPluginToLocale`, in the same way as in [lmsearch-plugin](https://github.com/origo-map/lmsearch-plugin). The help text has one file per language, `content/help.<language>.html`.

| Language | Locale | Button | Help text |
|----------|--------|--------|-----------|
| Swedish | `sv-SE` | Hjälp | yes |
| English | `en-US` | Help | yes |

If the map language is missing, the same language with another region is used (e.g. `en-GB` → `en-US`), otherwise Swedish. If `buttonText` or `title` is given as a string, it is used for all languages instead of the translation. They can also be set per language, e.g. `buttonText: { 'sv-SE': 'Hjälp', 'en-US': 'Help' }`.

To add a language: add `src/loc/<language>.json` and `content/help.<language>.html`, where `<language>` is the locale with `_` instead of `-` (e.g. `fi_FI`). The files are picked up automatically at build time. The help text should have the same sections and `data-help-*` attributes as the Swedish one. Contributions of new languages are welcome.

## Help content

The help text is in `content/` and is built into the plugin:

- `content/help.<language>.html` – the text itself as an HTML fragment, one file per language (see [Localization](#localization)). Each section is a `<details class="o-help-section">` with a `<summary>` as heading.
- `content/help.scss` – styling, scoped under `.o-help-body`.
- `content/img/*.png` – images referenced with `src="img/<file>.png"`. They are built into `help.js`, so no separate image files need to be deployed.

The bundled help text covers Origo's standard controls and some common plugins and external map services. Adapt the content in `content/` to your own map, or use `url` to point to your own help page.

### Help based on the map's controls

Sections and rows can be marked with `data-help-control` and are then only shown if the map has a control or plugin with that name. The condition can also require a setting in the control's `options`: `name[setting=value]` (for arrays: the array contains the value), `name[setting*=text]` (the value contains the text), `name[setting]` (set to a truthy value) or `name[!setting]` (not set or falsy). The conditions only read what is in the map configuration, not the control's default values, so a default setting has to be written as `name[!setting]`. This is needed when the same control appears several times with different settings. The path can go into objects and arrays with a dot, e.g. `externalurl[links.url*=mapillary.com]`, which is true if any link has a url containing `mapillary.com`. Multiple conditions are separated by spaces and it is enough that one of them is met. Parts without the attribute are always shown. The check is done every time the help is opened.

```html
<details class="o-help-section" data-help-control="draw drawplugin">
```

For plugins that don't expose their settings, you can instead require that an element exists in the map with `data-help-element` (css selector). If both attributes are given, both conditions must be met.

```html
<div class="list-group-item" data-help-element=".o-estate">
```

Names currently in use:

| Section | Control/plugin |
|---------|----------------|
| Search | `search`, `lmsearch` (Show property: the `.o-estate` button, which lmsearch creates when `estateLookup` is on) |
| Zoom and navigate | `zoom`, `home`, `geoposition`, `rotate`, `scalepicker` (per row) |
| Show and hide map layers | `legend` |
| Measure | `measure`. The buttons according to `measureTools` (`length`, `area`, `elevation`, `buffer`; without `measureTools` the defaults `length` and `area` apply), segment lengths: `showSegmentLengths`, elevation profile: the `elevationProfile` plugin ([elevation-profile-plugin-v2](https://github.com/jokd/elevation-profile-plugin-v2)) |
| Draw and write in the map | `draw`, `drawplugin` |
| Print | `print` |
| Share map | `sharemap` (Share map: `sharemap[storeMethod=saveStateToServer]`, API link: `sharemap[!storeMethod]`) |
| Map links to other maps | `externalurl`, each link by its url in `links`, e.g. `externalurl[links.url*=mapspace.com]` (Street View: `map_action=pano`, Google Maps: `map_action=map`) |
| Add temporary layers | `draganddrop` (the button for files on the device: `draganddrop[showLegendButton]`) |
| Coordinate systems and coordinates | `position` (the coordinate tool: `coordinateFinder`) |
| Embedded maps | `fullscreen` |
| Filter function | `origofilteretuna` |
| Compare map views | `swiper` |
| Select in the map | `multiselection` |
| Other | menu: `mapmenu`, save map image: `exportmap`, link: `link`, login: `oidcComponent` |

Icons reference Origo's icon sprites directly, e.g. `<svg class="ico"><use href="#ic_search_24px"></use></svg>`.
Images with an absolute path (e.g. `/img/png/osm.png`) are loaded from the map application and are not built in.

## License

MIT, see [LICENSE](LICENSE).
