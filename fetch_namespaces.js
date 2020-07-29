const fetch_ns = (tenantURL, apiKey, processTags, dbHost, dbUser, dbPass, dbDb) => {
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
    if (process.env.LOG_LEVEL == 'debug'){
       con_opts.debug = true;
    }
    con = mysql.createPool(con_opts); 
    console.log(new Date(), "Importing namespace details");

    con.on('error', function(err) {
       console.log(new Date(),err.code);
    });

    // fecth the pgi data and populate namespace in db
    let formatTags = Array.isArray(processTags) ? `&tag=${processTags.join('&tag=')}` : '';
    apiURI = `/api/v1/entity/infrastructure/processes`;
    let params = `?includeDetails=true&relativeTime=2hours${formatTags}`;
    (async () => {
        let r = await fetch(`${tenantURL}${apiURI}${params}`, {'headers': headers});
        let rj = await r.json();
        let tmp_v = [];
        for (let h of rj){
            try {
                tmp_v.push(`("${h.entityId}", "${h.metadata.kubernetesNamespaces.join(',')}")`);
            } catch(e) { continue; }
        }
        let q = `INSERT INTO tbl_pgi2host (pgi_id, namespaces) VALUES ${tmp_v.join(', ')} ON DUPLICATE KEY UPDATE namespaces=VALUES(namespaces)`;
        if (tmp_v.length > 0){
            con.query(q, function (err) {
                if (err) { throw err } else {
                    con.end(() => { console.log(new Date(), ' - namespace data imported'); });
                }
            });
        }
    })().catch(e => { console.log(new Date(), e); });
}
module.exports = {
    fetch_ns: fetch_ns,
};
