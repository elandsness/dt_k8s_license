const fetch_ns = (tenantURL, apiKey, processTags, dbHost, dbUser, dbPass, dbDb) => {
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

    // fecth the pgi data and populate namespace in db
    let formatTags = Array.isArray(processTags) ? `&tag=${processTags.join('&tag=')}` : '';
    apiURI = `/api/v1/entity/infrastructure/processes?includeDetails=true&relativeTime=2hours${formatTags}`;
    console.log(`${tenantURL}${apiURI}`);
    (async () => {
        let r = await fetch(`${tenantURL}${apiURI}`, {'headers': headers});
        let rj = await r.json();
        await Promise.all(
            rj.map(async h => {
                    if (h.hasOwnProperty('metadata')){
                        if (h.metadata.hasOwnProperty('kubernetesNamespaces')){
                            // write pgi namespaces
                            let q = `INSERT INTO tbl_pgi2host (pgi_id, namespaces) VALUES ("${h.entityId}",
                                "${h.metadata.kubernetesNamespaces.join(',')}")
                                ON DUPLICATE KEY UPDATE pgi_id="${h.entityId}",
                                namespaces="${h.metadata.kubernetesNamespaces.join(',')}"`;
                            con.query(q, function (err) {
                                if (err) throw err;
                            });
                        }
                    }
            })
        ).then(con.end(() => { console.log(`${new Date()} - namespace data imported`); })).catch(e => { console.log(e); });
    })().catch(e => { console.log(e); });
}
module.exports = {
    fetch_ns: fetch_ns,
};