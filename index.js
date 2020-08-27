// Load required packages
const fetchhost = require('./fetch_host_data').fetch_host; // for fetching host data
const fetchpgi = require('./fetch_pgi_data').fetch_pgi; // for fetching pgi data
const fetchns = require('./fetch_namespaces').fetch_ns; // for fetching namespaces
const server_report = require('./k8s_server_report').server_report; // returns the server HU calculations
const audit_records = require('./audit_records').audit_records; // anylizes data in DB and reports back
const schedule = require('node-schedule'); // for scheduling jobs
const express = require('express'); // for exposing api endpoint to query data
const app = express();
require('dotenv').config(); // read in vars from .env
const mysql = require('mysql'); // for connecting to db

// load config
const tenantURLs = process.env.TENANT_URL.split('||');
const apiKeys = process.env.DYNATRACE_API_KEY.split('||'); // dynatrace api key
const tags = process.env.HOST_TAGS == null ? '' : `&tag=${process.env.HOST_TAGS.split(',').join('&tag=')}`; // if tags are set, store as query string
const ptags = process.env.PROCESS_TAGS == null ? '' : process.env.PROCESS_TAGS.split(','); // if tags are set, store as array
const adjWaitTime = process.env.THROTTLE_IMPORT == null ? 15 : parseInt(process.env.THROTTLE_IMPORT);

// connect to the db
let con_opts = {
   host: process.env.DB_HOST,
   user: process.env.DB_USER,
   password: process.env.DB_PASS,
   database: process.env.DB,
   connectionLimit: 5
}
if (process.env.LOG_LEVEL == 'debug'){
   con_opts.debug = true;
}
let con = mysql.createPool(con_opts); 
console.log(new Date(), "Connection pool established");

con.on('error', function(err) {
   console.log(new Date(),err.code);
});

con.on('acquire', function() {
   console.log(new Date(), `Acquired connection`);
});

con.on('connection', function() {
   console.log(new Date(), `Connected`);
});

con.on('enqueue', function() {
   console.log(new Date(), `Connection queued`);
});

con.on('release', function() {
   console.log(new Date(), `Connection released`);
});

// hourly data fetch
let j = schedule.scheduleJob('1 * * * *', function(){
    for (let t in tenantURLs){
        const tenantURL = tenantURLs[t].slice(-1) === '/' ? tenantURLs[t].slice(0, -1) : tenantURLs[t]; // tenant url
        const apiKey = apiKeys[t];
        try {
            fetchhost(tenantURL,apiKey,tags,con);
            fetchpgi(tenantURL,apiKey,ptags,con,1);
        } catch(e) {
            console.log(new Date(), e);
        }
    }
});

// hourly data fetch
let dj = schedule.scheduleJob('46 * * * *', function(){
    for (let t in tenantURLs){
        const tenantURL = tenantURLs[t].slice(-1) === '/' ? tenantURLs[t].slice(0, -1) : tenantURLs[t]; // tenant url
        const apiKey = apiKeys[t];
        try {
            fetchns(tenantURL,apiKey,ptags,con);
        } catch(e) {
            console.log(new Date(), e);
        }
    }
});

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
   const getData = server_report(from, to, con);
    getData.then((r) => {
        res.send(r);
    }).catch((e) => { console.log(new Date(), e) });
});

// import past pgi data
app.get('/pgi/:start/:end?', async (req, res) => {
    // turn params into usable start and end dates
    let s = new Date(req.params.start); // start
    let e = req.params.end ? new Date(req.params.end) : new Date(req.params.start); // end
    s.setUTCHours(0,0,0,0);
    e.setUTCHours(24,0,0,0);
    let waittime = 0;
    for (let i = s.getTime(); i <= e.getTime(); i += 1000*60*60){
        let timeBox = `&from=${i}&to=${i + (1000*60*60)}&resolution=Inf`;
        for (let t in tenantURLs){
            const tenantURL = tenantURLs[t].slice(-1) === '/' ? tenantURLs[t].slice(0, -1) : tenantURLs[t]; // tenant url
            const apiKey = apiKeys[t];
            setTimeout(() => {fetchpgi(tenantURL,apiKey,ptags,con,0,timeBox)}, waittime * 1000);
            waittime += adjWaitTime;
        }
    }
    res.send(`Importing data between ${s} and ${e}.`);
});

app.get('/nsimport', async (req, res) => {
    for (let t in tenantURLs){
        const tenantURL = tenantURLs[t].slice(-1) === '/' ? tenantURLs[t].slice(0, -1) : tenantURLs[t]; // tenant url
        const apiKey = apiKeys[t];
        fetchns(tenantURL,apiKey,ptags,con);
    }
    res.send(`Fetching namespace data.`);
})

app.get('/audit', async (req, res) => {
    audit_records(con).then(m => {
        res.json(m);
    })
})

app.listen(process.env.PORT);
console.log(new Date(), `API Server Listening on Port ${process.env.PORT}`);