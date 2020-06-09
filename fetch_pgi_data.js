const fetch_pgi = (tenantURL, apiKey, processTags, dbHost, dbUser, dbPass, dbDb) => {
    // Load required packages
    const fetch = require('node-fetch'); // for making http calls
    const mysql = require('mysql'); // for connecting to db

    // Setup variables
    const headers = {
        'Authorization': `Api-Token ${apiKey}`,
        'Accept': 'application/json'
    }; // headers used during api calls

    // connect to the db
    const con = mysql.createConnection({
            host: dbHost,
            user: dbUser,
            password: dbPass,
            database: dbDb
        }); 
        con.connect(function(err) {
        if (err) throw err;
        console.log("Connected!");
    });

    // function for storing pgi data
    const storePGI = (pgi) => {
        let q = `INSERT INTO tbl_pgidata (pgi_id, timestamp, memory)
        VALUES ("${pgi.dimensions[0]}","${pgi.timestamps[0]}","${(pgi.values[0]/1024/1024/1024)}")
        ON DUPLICATE KEY UPDATE pgi_id="${pgi.dimensions[0]}", timestamp="${pgi.timestamps[0]}",
        memory="${(pgi.values[0]/1024/1024/1024)}"`;
        con.query(q, function (err) {
            if (err) throw err;
        });
    }

    // Fetch metrics for memory utilization
    (async () => {
            apiURI = '/api/v2/metrics/query'
            let queryString = `?metricSelector=builtin:tech.generic.mem.workingSetSize:max&resolution=1h&from=now-1h/h&to=now-0h/h`;
            let formatTags = Array.isArray(processTags) ? `&entitySelector=type(PROCESS_GROUP_INSTANCE),tag(${processTags.join('),tag(')})` : '';
            let r = await fetch(`${tenantURL}${apiURI}${queryString}&pageSize=1000${formatTags}`, {'headers': headers});
            let rj = await r.json();
            nextKey = rj.nextPageKey;

            await Promise.all(
                rj.result[0].data.map((pgi) => { storePGI(pgi) })
            ).catch(e =>{ console.log(rj, e) });
    })().then(async () => {
        const fetchNext = async (k) => {
            let r = await fetch(`${tenantURL}${apiURI}?nextPageKey=${k}`, {'headers': headers});
            let rj = await r.json();
            nextKey = rj.nextPageKey;
            await Promise.all(
                rj.result[0].data.map((pgi) => { storePGI(pgi) })
            ).catch(e =>{ console.log(rj, e) });
            return rj.nextPageKey;
        }
        // loop function wrapped in promise, so we can wait to continue until we've run all the needed api calls
        const loopy = async () => {
            return new Promise(async (resolve) => {
                while(nextKey != null){
                    nextKey = await fetchNext(nextKey);
                }
                resolve();
            })
        }
        // run the loop then continue
        loopy().then(() => {
            con.end(() => { console.log(new Date(), ' - pgi data imported'); });
        }).catch((error) => {console.log(error)})
    }).catch(function (error) {
        // handle error
        console.log(error);
    });
}
module.exports = {
    fetch_pgi: fetch_pgi,
};