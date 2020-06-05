// Load required packages
const fetchhost = require('./fetch_host_data').fetch_host; // for fetching host data
const fetchpgi = require('./fetch_pgi_data').fetch_pgi; // for fetching pgi data
const schedule = require('node-schedule'); // for scheduling jobs
require('dotenv').config(); // read in vars from .env
// load config
const tenantURL = process.env.TENANT_URL.slice(-1) === '/' ? process.env.TENANT_URL.slice(0, -1) : process.env.TENANT_URL; // tenant url
const apiKey = process.env.DYNATRACE_API_KEY; // dynatrace api key
const tags = process.env.HOST_TAGS == null ? '' : `&tag=${process.env.HOST_TAGS.split(',').join('&tag=')}`; // if tags are set, store as query string
const ptags = process.env.PROCESS_TAGS == null ? '' : process.env.PROCESS_TAGS.split(','); // if tags are set, store as array

// hourly data fetch
let j = schedule.scheduleJob('1 * * * *', function(){
    fetchhost(tenantURL,apiKey,tags,process.env.DB_HOST,process.env.DB_USER,process.env.DB_PASS,process.env.DB);
    fetchpgi(tenantURL,apiKey,ptags,process.env.DB_HOST,process.env.DB_USER,process.env.DB_PASS,process.env.DB);
});