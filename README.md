[![Build Status](https://travis-ci.com/enketo/enketo-express.svg?branch=master)](https://travis-ci.org/enketo/enketo-express)

Enketo Express
==============

_The modern [Enketo Smart Paper](https://enketo.org) web application._


**To get started visit our [technical documentation](https://enketo.github.io/enketo-express).**


### Translation

The user interface was translated by: Serkan Tümbaş (Turkish), Hélène Martin (French), Gurjot Sidhu(Hindi, Panjabi), "Abcmen" (Turkish), Otto Saldadze, Makhare Atchaidze, David Sichinava, Elene Ergeshidze (Georgian), Nancy Shapsough (Arabic), Noel O'Boyle (French), Miguel Moreno (Spanish), Tortue Torche (French), Bekim Kajtazi (Albanian), Marc Kreidler (German), Darío Hereñú (Spanish), Viktor S. (Russian), Alexander Torrado Leon (Spanish), Peter Smith (Portugese, Spanish), Przemysław Gumułka (Polish), Niklas Ljungkvist, Sid Patel (Swedish), Katri Jalava (Finnish), Francesc Garre (Spanish), Sounay Phothisane (Lao), Linxin Guo (Chinese), Emmanuel Jean, Renaud Gaudin (French), Trần Quý Phi (Vietnamese), Reza Doosti, Hossein Azad, Davood Mottalee (Persian), Tomas Skripcak (Slovak, Czech, German), Daniela Baldova (Czech), Robert Michael Lundin (Norwegian), Margaret Ndisha, Charles Mutisya (Swahili), Panzero Mauro (Italian), Gabriel Kreindler (Romanian), Jason Reeder, Omar Nazar, Sara Sameer, David Gessel (Arabic), Tino Kreutzer (German), Wasilis Mandratzis-Walz (German, Greek), Luis Molina (Spanish), Martijn van de Rijdt (Dutch).

_Send a message if you'd like to contribute! We use an easy web interface provided by [Transifex](https://www.transifex.com/projects/p/enketo-express/)._

### Releases

1. Create release PR
1. Check [Dependabot](https://github.com/enketo/enketo-express/security/dependabot) for alerts
1. Run `npm update`
    - Check if `node-forge` has been updated and if so, verify encrypted submissions end-to-end
1. Run `npm audit`
    - Run `npm audit fix --production` to apply most important fixes
1. Run `npm ci`
1. Run `npm test`
1. Run `npm run build-docs`
1. Update `CHANGELOG.md`
1. Update version in `package.json`
    - Bump to major version if consumers have to make changes.
1. Merge PR with all changes
1. Create GitHub release
1. Tag and publish the release
    - GitHub Action will publish it to npm

### Funding

The development of this application was funded by [KoBo Toolbox (Harvard Humanitarian Initiative)](http://www.kobotoolbox.org), [iMMAP](http://immap.org), [OpenClinica](https://openclinica.com), [London School of Hygiene and Tropical Medicine](https://opendatakit.lshtm.ac.uk/), [DIAL Open Source Center](https://www.osc.dial.community/) and [Enketo LLC](https://www.linkedin.com/company/enketo-llc). The [Enketo-core](https://github.com/enketo/enketo-core) library (the form engine + themes) used in this application obtained significant funding from [SEL (Columbia University)](http://modi.mech.columbia.edu/), the [Santa Fe Institute](http://www.santafe.edu/), [Ona](https://ona.io) and the [HRP project](http://www.who.int/reproductivehealth/topics/mhealth/en/).


### License

See [the license document](https://github.com/enketo/enketo-express/blob/master/LICENSE) for this application's license.

Note that some of the libraries used in this app have a different license. In particular note [this one](https://github.com/enketo/enketo-xpathjs).

Note the 'Powered by Enketo' footer requirement as explained in [enketo-core](https://github.com/enketo/enketo-core#license). This requirement is applicable to all Enketo apps, including this one, unless an exemption was granted.

The Enketo logo and Icons are trademarked by [Enketo LLC](https://www.linkedin.com/company/enketo-llc) and should only be used for the 'Powered by Enketo' requirement mentioned above (if applicable). To prevent infringement simply replace the logo images in [/public/images](https://github.com/enketo/enketo-express/blob/master/public/images) with your own or contact [Enketo LLC](mailto:info@enketo.org) to discuss the use inside your app.


### Change log

See [change log](https://github.com/enketo/enketo-express/blob/master/CHANGELOG.md)
