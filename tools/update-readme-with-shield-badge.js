/* eslint no-console: 0 */

/* **************
The only purpose of this script is to be used by the npm test script to write the shield badge within the README.md file
************** */

const fs = require('fs');
const path = require('path');
const istanbul = require('istanbul');

const collector = new istanbul.Collector();
const { Report } = istanbul;
const shieldBadgeReporter = require('istanbul-reporter-shield-badge');

istanbul.Report.register(shieldBadgeReporter);

const report = Report.create('shield-badge', {
    readmeFilename: 'README.md',
    readmeDir: path.resolve(__dirname, '..'),
    subject: 'coverage',
});

try {
    console.log(
        `\n====================== Adding the badge to the ${report.readmeFilename} =======================`
    );
    const serverCoverageDir = path.resolve(
        __dirname,
        '../test-coverage/server'
    );
    const clientCoverageDir = path.resolve(
        __dirname,
        '../test-coverage/client'
    );
    fs.readdirSync(serverCoverageDir).forEach((file) => {
        if (file.indexOf('coverage-final.json') === 0) {
            collector.add(
                JSON.parse(
                    fs.readFileSync(
                        path.resolve(serverCoverageDir, file),
                        'utf8'
                    )
                )
            );
        }
    });
    fs.readdirSync(clientCoverageDir).forEach((browserDir) => {
        if (browserDir.indexOf('HeadlessChrome') === 0) {
            const browserDirPath = path.resolve(clientCoverageDir, browserDir);
            fs.readdirSync(browserDirPath).forEach((file) => {
                if (file.indexOf('coverage-final.json') === 0) {
                    collector.add(
                        JSON.parse(
                            fs.readFileSync(
                                path.resolve(browserDirPath, file),
                                'utf8'
                            )
                        )
                    );
                }
            });
        }
    });
    report.on('done', () => {
        console.log(
            'The istanbul shield badge report has been generated (from both sources)'
        );
    });
    report.writeReport(collector, true);
} catch (err) {
    console.error(err.message);
    process.exit(1);
}
