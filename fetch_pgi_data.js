const fetch_pgi = (tenantURL, apiKey, processTags, con, pastHour, timeBox, isapi) => {
    // Load required packages
    const fetch = require('node-fetch'); // for making http calls

    // Setup variables
    const headers = {
        'Authorization': `Api-Token ${apiKey}`,
        'Accept': 'application/json'
    }; // headers used during api calls
    let apiURI; // stores api endpoint

    console.log(new Date(), "Fetching container memory data");

    // Fetch metrics for memory utilization
    (async () => {
            apiURI = '/api/v2/metrics/query'
            timeBox = timeBox ? timeBox : `&from=now-${pastHour}h/h&to=now-${pastHour - 1}h/h`;
            let queryString = `?metricSelector=builtin:tech.generic.mem.workingSetSize:max&resolution=1h${timeBox}`;
            let formatTags = Array.isArray(processTags) ? `&entitySelector=type(PROCESS_GROUP_INSTANCE),tag(${processTags.join('),tag(')})` : '';
            let r = await fetch(`${tenantURL}${apiURI}${queryString}&pageSize=1000${formatTags}`, {'headers': headers});
            if (process.env.LOG_LEVEL.toLowerCase().includes('api')){
                console.log(new Date(), `${tenantURL}${apiURI}${queryString}&pageSize=1000${formatTags}`);
            }
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
            if (process.env.LOG_LEVEL.toLowerCase().includes('api')){
                console.log(new Date(), `${tenantURL}${apiURI}?nextPageKey=${k}`);
            }
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
            console.log(new Date(), 'PGI data imported' + (isapi ? ' via API for ' + timeBox : ''));
        }).catch((error) => {console.log(new Date(), error)})
    }).catch(function (error) {
        // handle error
        console.log(new Date(), error);
    });
}
module.exports = {
    fetch_pgi: fetch_pgi,
};
