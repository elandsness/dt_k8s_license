const server_report = (from, to, con, tenantURL,apiKey,hostTags) => {
    return new Promise ((resolve) => {
        // Load required packages
        const percentile = require("percentile"); // calculates percentiles
        const createCsvStringifier = require('csv-writer').createObjectCsvStringifier; // for building the csv
        const fetch = require('node-fetch'); // for making http calls

        // Setup variables
        const F = 12; // gb ram per host unit
        const P = 99; // percentile used for calculations
        let data = {} // stages data before returning
        let trhu = 0, tahu = 0, tam = 0; // total reported hu, adj hu, and adj mem

        const headers = {
            'Authorization': `Api-Token ${apiKey}`,
            'Accept': 'application/json'
        }; // headers used during api calls

        console.log(new Date(), "Running server report");

        // hit the host api and get the  valid hosts for the last 3 days of time period the report is being run for
        let hosts = [];
        let chu = {};
        let hn = {};
        let formatTags = Array.isArray(hostTags) ? `&tag=${hostTags.join('$tag=')}` : '';
        let tmp_d = new Date(to);
        tmp_d.setDate(tmp_d.getDate() - 3);
        let formatDates = `&startTimestamp=${tmp_d.getTime()}&endTimestamp=${to}`;
        apiURI = `/api/v1/entity/infrastructure/hosts?showMonitoringCandidates=false${formatDates}${formatTags}`;
        (async () => {
            let r = await fetch(`${tenantURL}${apiURI}`, {'headers': headers});
            if (process.env.LOG_LEVEL.toLowerCase().includes('api')){
                console.log(new Date(), `${tenantURL}${apiURI}`);
            }
            let rj = await r.json();
            await Promise.all(
                rj.map(async h => {
                        if (h.hasOwnProperty('softwareTechnologies')){
                            for (let i of h.softwareTechnologies){
                                if (i.type.toUpperCase() == 'KUBERNETES' && h.monitoringMode.toUpperCase() === 'FULL_STACK'){
                                    // write host to db
                                    hosts.push(h.entityId);
                                    chu[h.entityId] = h.consumedHostUnits;
                                    hn[h.entityId] = h.displayName;
                                }
                            }
                        }
                })
            ).then(() => {
                // fetch the data
                let q = `SELECT host_id,
                        displayName,
                        consumedHostUnits,
                        timestamp,
                        SUM(memory) as memory
                    FROM tbl_hostmemdata
                    JOIN tbl_hostdata USING (host_id)
                    WHERE timestamp BETWEEN ${from} AND ${to}
                    AND host_id IN ("${hosts.join('", "')}")
                    GROUP BY host_id, timestamp
                    ORDER BY timestamp`;
                con.query(q, function (err, res) {
                if (err) throw err;
                for (let x of res){
                    if (data.hasOwnProperty(x.host_id)){
                        data[x.host_id].datapoints.push(x.memory);
                    } else {
                        data[x.host_id] = {
                            'entityID': x.host_id,
                            'datapoints': [x.memory],
                            'consumedHostUnits': x.consumedHostUnits,
                            'displayName': x.displayName
                        }
                    }
                }
                // calculate percentiles
                for (let x in data){
                    data[x].memUsed = parseFloat(Math.ceil(percentile(P, data[x].datapoints)));
                    data[x].adjHU = parseFloat(Math.ceil(data[x].memUsed / F));
                    data[x].adjHU = data[x].adjHU > data[x].consumedHostUnits ? data[x].consumedHostUnits : data[x].adjHU;
                    data[x].adjHU = data[x].adjHU < 1 ? 1 : data[x].adjHU;
                    trhu += data[x].consumedHostUnits;
                    tahu += data[x].adjHU;
                    tam += data[x].memUsed;
                }

                // add any infra only hosts
                for (let x of hosts){
                    if (!Object.keys(data).includes(x)){
                        data[x] = {
                            'entityID': x,
                            'displayName': hn[x],
                            'consumedHostUnits': chu[x],
                            'memUsed': 'n/a',
                            'adjHU': 1
                        }
                        tahu += 1;
                        trhu += chu[x];
                    }
                }

                // stage csv to return
                data.TOTALS = {
                    'entityID': 'TOTAL',
                    'displayName': '',
                    'consumedHostUnits': trhu,
                    'memUsed': tam,
                    'adjHU': tahu
                }
                const csvStringifier = createCsvStringifier({
                    header: [
                        {id: 'entityID', title: 'ID'},
                        {id: 'displayName', title: 'HOSTNAME'},
                        {id: 'consumedHostUnits', title: 'REPORTED_HU'},
                        {id: 'memUsed', title: 'ADJ_MEM'},
                        {id: 'adjHU', title: 'ADJ_HU'}
                    ]
                });
                resolve(csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(Object.values(data)));
                });
            });
        })().catch(e => { console.log(new Date(), e); });

    });
}
module.exports = {
    server_report: server_report,
};