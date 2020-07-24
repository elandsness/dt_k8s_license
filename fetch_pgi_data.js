const fetch_pgi = (tenantURL, apiKey, processTags, dbHost, dbUser, dbPass, dbDb, pastHour) => {
    // Load required packages
    const fetch = require('node-fetch'); // for making http calls
    const mysql = require('mysql'); // for connecting to db

    // Setup variables
    const headers = {
        'Authorization': `Api-Token ${apiKey}`,
        'Accept': 'application/json'
    }; // headers used during api calls
    let apiURI; // stores api endpoint

    // connect to the db
    let con;
    let con_opts = {
       host: dbHost,
       user: dbUser,
       password: dbPass,
       database: dbDb
    }
    if (process.env.LOG_LEVEL.toLowerCase() == 'debug'){
       con_opts.debug = true;
    }
    const connect_2_db = () => {
       con = mysql.createConnection(con_opts); 
       con.connect(function(err) {
       if (err) throw err;
             console.log(new Date(), "Connected!");
       });
    }
    connect_2_db();

    con.on('error', function(err) {
       console.log(new Date(),err.code);
       connect_2_db();
    });

    // Fetch metrics for memory utilization
    (async () => {
            apiURI = '/api/v2/metrics/query'
            let timeBox = `&from=now-${pastHour}h/h&to=now-${pastHour - 1}h/h`;
            let queryString = `?metricSelector=builtin:tech.generic.mem.workingSetSize:max&resolution=1h${timeBox}`;
            let formatTags = Array.isArray(processTags) ? `&entitySelector=type(PROCESS_GROUP_INSTANCE),tag(${processTags.join('),tag(')})` : '';
            let r = await fetch(`${tenantURL}${apiURI}${queryString}&pageSize=1000${formatTags}`, {'headers': headers});
            let rj = await r.json();
            nextKey = rj.nextPageKey;
            let tmp_v = [];
            for (let x of rj.result[0].data){
                try {
                    tmp_v.push(`('${x.dimensions[0]}', ${x.timestamps[0]}, ${(x.values[0]/1024/1024/1024)})`);
                } catch(e) { continue; }
            }
            if (tmp_v.length > 0){
                let insert_q = `REPLACE INTO tbl_pgidata (pgi_id, timestamp, memory) VALUES ${tmp_v.join(', ')}`;
                con.query(insert_q, function (err) {
                    if (err) throw err;
                });
            }
    })().then(async () => {
        const fetchNext = async (k) => {
            let r = await fetch(`${tenantURL}${apiURI}?nextPageKey=${k}`, {'headers': headers});
            let rj = await r.json();
            nextKey = rj.nextPageKey;
            let tmp_v = [];
            for (let x of rj.result[0].data){
                try {
                    tmp_v.push(`('${x.dimensions[0]}', ${x.timestamps[0]}, ${(x.values[0]/1024/1024/1024)})`);
                } catch(e) { continue; }
            }
            if (tmp_v.length > 0){
                let insert_q = `REPLACE INTO tbl_pgidata (pgi_id, timestamp, memory) VALUES ${tmp_v.join(', ')}`;
                con.query(insert_q, function (err) {
                    if (err) throw err;
                });
            }
            return rj.nextPageKey;
        }
        // loop function wrapped in promise, so we can wait to continue until we've run all the needed api calls
        const loopy = async () => {
            return new Promise(async (resolve) => {
                while(nextKey != null){
                    nextKey = await fetchNext(nextKey).catch(e => {console.log(new Date(), e)});
                }
                resolve();
            }).catch(e => { console.log(new Date(), e) })
        }
        // run the loop then continue
        loopy().then(() => {
            con.end(() => { console.log(new Date(), ' - pgi data imported'); });
        }).catch((error) => {console.log(new Date(), error)})
    }).catch(function (error) {
        // handle error
        console.log(new Date(), error);
    });
}
module.exports = {
    fetch_pgi: fetch_pgi,
};
