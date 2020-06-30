// Load required packages
const fetchhost = require('./fetch_host_data').fetch_host; // for fetching host data
const fetchpgi = require('./fetch_pgi_data').fetch_pgi; // for fetching pgi data
const fetchns = require('./fetch_namespaces').fetch_ns; // for fetching namespaces
const collate_data = require('./collate_data').collate_data; // for reducing data requirements
const server_report = require('./k8s_server_report').server_report; // returns the server HU calculations
const schedule = require('node-schedule'); // for scheduling jobs
const express = require('express'); // for exposing api endpoint to query data
const app = express();
require('dotenv').config(); // read in vars from .env
// load config
const tenantURLs = process.env.TENANT_URL.split('||');
const apiKeys = process.env.DYNATRACE_API_KEY.split('||'); // dynatrace api key
const tags = process.env.HOST_TAGS == null ? '' : `&tag=${process.env.HOST_TAGS.split(',').join('&tag=')}`; // if tags are set, store as query string
const ptags = process.env.PROCESS_TAGS == null ? '' : process.env.PROCESS_TAGS.split(','); // if tags are set, store as array

// hourly data fetch
let j = schedule.scheduleJob('1 * * * *', function(){
    for (let t in tenantURLs){
        const tenantURL = tenantURLs[t].slice(-1) === '/' ? tenantURLs[t].slice(0, -1) : tenantURLs[t]; // tenant url
        const apiKey = apiKeys[t];
        try {
            fetchhost(tenantURL,apiKey,tags,process.env.DB_HOST,process.env.DB_USER,process.env.DB_PASS,process.env.DB);
            fetchpgi(tenantURL,apiKey,ptags,process.env.DB_HOST,process.env.DB_USER,process.env.DB_PASS,process.env.DB,1);
            fetchns(tenantURL,apiKey,ptags,process.env.DB_HOST,process.env.DB_USER,process.env.DB_PASS,process.env.DB);
        } catch(e) {
            console.log(e);
        }
    }
});

// hourly data collation
let cj = schedule.scheduleJob('31 * * * *', function(){
    try {
        let s = new Date();
        s.setMinutes(s.getMinutes - 95);
        let e = new Date(s.getTime());
        e.setMinutes(e.getMinutes() + 70);
        collate_data(s.getTime(),e.getTime(),process.env.DB_HOST,process.env.DB_USER,process.env.DB_PASS,process.env.DB).then(m => {
            console.log(`${new Date()} ${m}`);
        })
    } catch(e) {
        console.log(e);
    }
})

// routes
// host report
app.get('/hostreport', async (req, res) => {
    let d = new Date(), from, to, fErr;
    if (req.query.hasOwnProperty("start")){
        from = (new Date(req.query.start)).getTime();
    } else {
        // default to last month
        d.setMonth(d.getMonth() - 1)
        const y = d.getFullYear(), m = d.getMonth();
        from = (new Date(y, m, 1)).getTime();
    }
    if (req.query.hasOwnProperty("end")){
        to = (new Date(req.query.end)).getTime();
    } else {
        // default to now
        to = (new Date()).getTime();
    }
   const getData = server_report(from, to, process.env.DB_HOST, process.env.DB_USER, process.env.DB_PASS, process.env.DB);
    getData.then((r) => {
        res.send(r);
    }).catch((e) => { console.log(e) });
});

// import past pgi data
app.get('/pgi/:hourOffset', async (req, res) => {
    for (let t in tenantURLs){
        const tenantURL = tenantURLs[t].slice(-1) === '/' ? tenantURLs[t].slice(0, -1) : tenantURLs[t]; // tenant url
        const apiKey = apiKeys[t];
        try {
            fetchpgi(tenantURL,apiKey,ptags,process.env.DB_HOST,process.env.DB_USER,process.env.DB_PASS,process.env.DB,req.params.hourOffset);
        } catch(e) {
            console.log(e);
        }
    }
    res.send(`Importing data from ${req.params.hourOffset} hour(s) ago.`);
});

app.listen(process.env.PORT);
console.log(`API Server Listening on Port ${process.env.PORT}`);