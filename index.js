const server_report = require('./k8s_server_report').server_report
const chargeback_report = require('./k8s_chargeback_report').chargeback_report
require('dotenv').config(); // read in vars from .env
const fs = require('fs'); // access filesystem to check and create dir if required

// load config
const tenantURL = process.env.TENANT_URL.slice(-1) === '/' ? process.env.TENANT_URL.slice(0, -1) : process.env.TENANT_URL; // tenant url
const apiKey = process.env.DYNATRACE_API_KEY; // dynatrace api key
const tags = process.env.HOST_TAGS == null ? '' : `&tag=${process.env.HOST_TAGS.join('&tag=')}`; // if tags are set, store as query string
const huFactor = 12; // number of GB per HU
const percentileCutoff = 99; // percentile to calculate HU

// Handle command line args
var argv = require('yargs')
    .usage('Usage: $0 [-s, -c, -p <path to directory>]')
    .boolean('u')
    .boolean('c')
    .default('p', process.env.FILE_PATH == null ? './export' : process.env.FILE_PATH)
    .describe('p','Directory path to store reports ("./some/path")')
    .describe('u', 'Run host unit report')
    .describe('c','Run container memory and namespace report')
    .argv;

// see if the dir already exists. if not, create it or fall back to ./ if not able to
try {
    if (!fs.existsSync(argv.p)){
        fs.mkdirSync(argv.p);
    }
} catch(e) {
    // no permission to create dir, so just store in ./
    argv.p = './';
}

if (argv.u)
    server_report(tenantURL, apiKey, tags, argv.p, huFactor, percentileCutoff, argv.details);
if (argv.c)
    chargeback_report(tenantURL, apiKey, tags, argv.p);
if (!argv.u & !argv.c)
    console.log(`You've opted to run no reports... Try passing -u, -c or both.`)