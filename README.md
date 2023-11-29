# Enketo Express

### ⚠️ Enketo Express code and issues have moved to [the Enketo monorepo](https://github.com/enketo/enketo) ⚠️

---

_The [Enketo Smart Paper](https://enketo.org) web application._ It can be used directly by form servers or used as inspiration for building applications that wrap [Enketo Core](https://github.com/enketo/enketo-core). See [this diagram](https://enketo.org/develop/) for a summary of how the different Enketo components are related.

**To get started visit our [technical documentation](https://enketo.github.io/enketo-express).**

### Project status

Enketo was initiated in 2009 by Martijn van de Rijdt as a web-based alternative or complement to [ODK Collect](https://docs.getodk.org/collect-intro/). It has become a core component of the ODK ecosystem and been adopted by several organizations beyond that ecosystem.

As of 2022, Enketo is maintained by the [ODK team](https://getodk.org/about/team.html) (primarily [Trevor Schmidt](https://github.com/eyelidlessness/)). Martijn continues to provide advice and continuity. The ODK project sets priorities in collaboration with its [Technical Advisory Board](https://getodk.org/about/ecosystem.html).

Our current primary goals are:

-   Increasing alignment with ODK Collect, particularly in service of submission edits.
-   Improving error messages so that users can get out of bad states.
-   Improving long-term maintainability by modernizing code bases, removing code duplication, and simplifying state mutation.

Feature requests and project discussion are welcome on the [ODK forum](https://forum.getodk.org/).

### Translation

The user interface was translated by: Oleg Zhyliak (Ukrainian), Karol Kozyra (Swedish), Badisches Rotes Kreuz (German), Serkan Tümbaş (Turkish), Hélène Martin (French), Gurjot Sidhu(Hindi, Panjabi), "Abcmen" (Turkish), Otto Saldadze, Makhare Atchaidze, David Sichinava, Elene Ergeshidze (Georgian), Nancy Shapsough (Arabic), Noel O'Boyle (French), Miguel Moreno (Spanish), Tortue Torche (French), Bekim Kajtazi (Albanian), Marc Kreidler (German), Darío Hereñú (Spanish), Viktor S. (Russian), Alexander Torrado Leon (Spanish), Peter Smith (Portugese, Spanish), Przemysław Gumułka (Polish), Niklas Ljungkvist, Sid Patel (Swedish), Katri Jalava (Finnish), Francesc Garre (Spanish), Sounay Phothisane (Lao), Linxin Guo (Chinese), Emmanuel Jean, Renaud Gaudin (French), Trần Quý Phi (Vietnamese), Reza Doosti, Hossein Azad, Davood Mottalee (Persian), Tomas Skripcak (Slovak, Czech, German), Daniela Baldova (Czech), Robert Michael Lundin (Norwegian), Margaret Ndisha, Charles Mutisya (Swahili), Panzero Mauro (Italian), Gabriel Kreindler (Romanian), Jason Reeder, Omar Nazar, Sara Sameer, David Gessel (Arabic), Tino Kreutzer (German), Wasilis Mandratzis-Walz (German, Greek), Luis Molina (Spanish), Martijn van de Rijdt (Dutch).

_Send a message if you'd like to contribute! We use an easy web interface provided by [Transifex](https://www.transifex.com/projects/p/enketo-express/)._

### Releases

1. Create release PR
1. Check [Dependabot](https://github.com/enketo/enketo-express/security/dependabot) for alerts
1. Run `npm update`
    - Check if `node-forge` has been updated and if so, verify encrypted submissions end-to-end
1. Run `npm audit`
    - Run `npm audit fix --production` to apply most important fixes
1. Update version in `package.json`
    - Bump to major version if consumers have to make changes.
1. Run `npm i`
1. Run `npm test`
1. Run `npm run build-docs`
1. Update `CHANGELOG.md`
1. Merge PR with all changes
1. Create GitHub release
1. Tag and publish the release
    - GitHub Action will publish it to npm

### Funding

The development of this application is now led by [ODK](https://getodk.org) and funded by customers of the ODK Cloud hosted service.

Past funders include [KoBo Toolbox (Harvard Humanitarian Initiative)](http://www.kobotoolbox.org), [iMMAP](http://immap.org), [OpenClinica](https://openclinica.com), [London School of Hygiene and Tropical Medicine](https://opendatakit.lshtm.ac.uk/), [DIAL Open Source Center](https://www.osc.dial.community/) and [Enketo LLC](https://www.linkedin.com/company/enketo-llc). Also see [Enketo Core sponsors](https://github.com/enketo/enketo-core#sponsors).

### License

See [the license document](https://github.com/enketo/enketo-express/blob/master/LICENSE) for this application's license.

Note that some of the libraries used in this app have a different license.

Note the 'Powered by Enketo' footer requirement as explained in [enketo-core](https://github.com/enketo/enketo-core#license). This requirement is applicable to all Enketo apps, including this one, unless an exemption was granted.

The Enketo logo and Icons are trademarked by [Enketo LLC](https://www.linkedin.com/company/enketo-llc) and should only be used for the 'Powered by Enketo' requirement mentioned above (if applicable). To prevent infringement simply replace the logo images in [/public/images](https://github.com/enketo/enketo-express/blob/master/public/images) with your own or contact [Enketo LLC](mailto:info@enketo.org) to discuss the use inside your app.

### Change log

See [change log](https://github.com/enketo/enketo-express/blob/master/CHANGELOG.md)
