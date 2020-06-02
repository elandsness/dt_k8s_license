const server_report = (tenantURL, apiKey, hostTags, processTags, filePath, huFactor, percentileCutoff, detailedReport, s_date, e_date) => {
    // Load required packages
    const fetch = require('node-fetch'); // for making http calls
    const percentile = require("percentile"); // calculates percentiles
    const createCsvWriter = require('csv-writer').createObjectCsvWriter; // for building csv from objects
    const createArrayCsvWriter = require('csv-writer').createArrayCsvWriter; // for building csv from arrays

    // Setup variables
    const headers = {
        'Authorization': `Api-Token ${apiKey}`,
        'Accept': 'application/json'
    }; // headers used during api calls
    let k8shosts = {}; // array to store list of k8s hosts
    let apiURI = ''; // used to stage api endpoints before querying
    let totalMem = 0, totalHU = 0; totalOldHU = 0; // to calculate total memory and HUs
    let detailData = []; // fow raw data report when detailedReport is enabled
    let nextKey = null; // to track next page key so we can handle pagination
    let pgiHostRelationship = {}; // stores relationships of PGI to Host by ID

    // get start and end timestamps based on passed values or last month if none passed
    let d = new Date(), from, to;
    if (s_date && e_date){
        try {
            from = (new Date(s_date)).getTime();
            to = (new Date(e_date)).getTime();
        } catch(e) {
            console.log('Please supply start and end datetimes in this format: mm/dd/yyyy hh:mm [am,pm]');
            return;
        }
    } else {
        d.setMonth(d.getMonth() - 1)
        const y = d.getFullYear(), m = d.getMonth();
        from = (new Date(y, m, 1)).getTime();
        to = (new Date(y, m + 1, 0)).getTime();
    }

    console.log(`Running report from ${from} to ${to}`);

    const threeDays = 3*24*60*60*1000;

    const fetchHost = async (timeframe) => {
        formatTags = Array.isArray(hostTags) ? `&tag=${hostTags.join('$tag=')}` : '';
        apiURI = `/api/v1/entity/infrastructure/hosts?showMonitoringCandidates=false${formatTags}`;
        let r = await fetch(`${tenantURL}${apiURI}${timeframe}`, {'headers': headers})
        console.log(`${tenantURL}${apiURI}${timeframe}`);
        let rj = await r.json()
        await Promise.all(
            rj.map(async h => {
                if (h.hasOwnProperty('softwareTechnologies')){
                    for (let i of h.softwareTechnologies){
                        if (i.type.toUpperCase() == 'KUBERNETES' && h.monitoringMode.toUpperCase() === 'FULL_STACK'){
                            h.toRelationships.isProcessOf.map(v => {pgiHostRelationship[v] = h.entityId});
                            if (k8shosts.hasOwnProperty(h.entityId)){
                                k8shosts[h.entityId].consumedHostUnits = Math.max(h.consumedHostUnits, k8shosts[h.entityId].consumedHostUnits);
                                return null;
                            } else {
                                k8shosts[h.entityId] = {
                                    'entityId': h.entityId,
                                    'displayName': h.displayName,
                                    'consumedHostUnits': h.consumedHostUnits
                                }
                            }
                        }
                    }
                }
            })
        );
    }
    // loop function wrapped in promise, so we can wait to continue until we've run all the needed api calls
    const loopHosts = async () => {
        let start = from, end = start + threeDays;
        return new Promise(async (resolve) => {
            while(start < to){
                await fetchHost(`&startTimestamp=${start}&endTimestamp=${end}`);
                start += threeDays;
                end = (end + threeDays) > to ? to : end + threeDays;
            }
            resolve();
        })
    }
    // run the loop then continue
    loopHosts().then(async () => {
        // get rid of duplicates in the host list
        // k8shosts = k8shosts.filter((v,i,a)=>a.findIndex(t=>(t.entityId === v.entityId))===i)
        // Fetch metrics for memory utilization
        apiURI = '/api/v2/metrics/query'
        let queryString = `?metricSelector=builtin:tech.generic.mem.workingSetSize:max&resolution=1h&from=${from}&to=${to}`;
        let formatTags = Array.isArray(processTags) ? `&entitySelector=type(PROCESS_GROUP_INSTANCE),tag(${processTags.join('),tag(')})` : '';
        let r = await fetch(`${tenantURL}${apiURI}${queryString}&pageSize=100${formatTags}`, {'headers': headers});
        console.log(`${tenantURL}${apiURI}${queryString}&pageSize=100${formatTags}`);
        let rj = await r.json();
        nextKey = rj.nextPageKey;
        if (detailedReport) {
            let line = ['', ...rj.result[0].data[0].timestamps];
            detailData.push(line);
        }
        await Promise.all(
            rj.result[0].data.map(async h => {
                try {
                    if (pgiHostRelationship.hasOwnProperty(h.dimensions[0])){
                        if (k8shosts.hasOwnProperty(pgiHostRelationship[h.dimensions[0]])){
                            if (k8shosts[pgiHostRelationship[h.dimensions[0]]].hasOwnProperty('rawMem')){
                                await k8shosts[pgiHostRelationship[h.dimensions[0]]].rawMem.map((x,i) => x + (h.values[i]/(1024*1024*1024)))
                            } else {
                                k8shosts[pgiHostRelationship[h.dimensions[0]]].rawMem = h.values.map(x => x / (1024*1024*1024));
                            }
                        }
                    }
                } catch (e) { console.log(e) }
            })
        )
    }).then(async () => {
        const fetchNext = async (k) => {
            let r = await fetch(`${tenantURL}${apiURI}?nextPageKey=${k}`, {'headers': headers})
            console.log(`${tenantURL}${apiURI}?nextPageKey=${k}`);
            let rj = await r.json();
            nextKey = rj.nextPageKey;
            await Promise.all(
                await rj.result[0].data.map(async h => {
                    try {
                        if (pgiHostRelationship.hasOwnProperty(h.dimensions[0])){
                            if (k8shosts.hasOwnProperty(pgiHostRelationship[h.dimensions[0]])){
                                if (k8shosts[pgiHostRelationship[h.dimensions[0]]].hasOwnProperty('rawMem')){
                                    await k8shosts[pgiHostRelationship[h.dimensions[0]]].rawMem.map((x,i) => x + (h.values[i]/(1024*1024*1024)))
                                } else {
                                    k8shosts[pgiHostRelationship[h.dimensions[0]]].rawMem = h.values.map(x => x / (1024*1024*1024));
                                }
                            }
                        }
                    } catch (e) { console.log(e) }
                })
            )
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
        loopy().then(async () => {
            // calculate HUs and drop into a CSV
            // convert bytes to gb, calc HU and calulate totals
            for (let host in k8shosts) {
                // if there's no memory metrics for the host, it wasn't running during the period
                let memInGb = percentile(percentileCutoff, k8shosts[host].rawMem.filter((obj) => obj ));
                let hu = parseFloat(Math.ceil(memInGb / huFactor));
                hu = hu > k8shosts[host].consumedHostUnits ? k8shosts[host].consumedHostUnits : hu; // in case host is at or near capacity
                k8shosts[host].memory = memInGb ? memInGb.toFixed(2) : 0;
                totalMem += parseFloat(k8shosts[host].memory);
                k8shosts[host].hostUnits = parseFloat(hu);
                totalHU += parseFloat(hu) ? parseFloat(hu) : 0;
                totalOldHU += k8shosts[host].consumedHostUnits;
                console.log(k8shosts[host].entityId,' => ',k8shosts[host].consumedHostUnits,' + ',totalHU)
            }
        }).catch((error) => {console.log(error)}).finally(async () => {
            // stage csv, add totals and dump everything to a file
            const totals = [{
                'entityId': 'TOTALS',
                'displayName': '',
                'memory': totalMem.toFixed(2),
                'consumedHostUnits': totalOldHU,
                'hostUnits': totalHU
            }]
            let hostList = [];
            for (let i in k8shosts){
                hostList.push(k8shosts[i]);
            }
            while (hostList.length < k8shosts.length){}
            const csvWriter = createCsvWriter({
                path: `${filePath}/k8s_host_${d.getTime()}.csv`,
                header: [
                    {id: 'entityId', title: 'DT_ID'},
                    {id: 'displayName', title: 'HOSTNAME'},
                    {id: 'memory', title: 'MEM_GB'},
                    {id: 'consumedHostUnits', title: 'REPORTED_HU'},
                    {id: 'hostUnits', title: 'ADJUSTED_HU'}
                ]
            });
            csvWriter.writeRecords(hostList)
            .then(() => {
                csvWriter.writeRecords(totals)
                .then(() => {
                    console.log('Host unit report complete.');
                }).catch((e) => { console.log(e); });
            }).catch((e) => { console.log(e); });
            
            // if detailedReport, then write out the raw metrics
            if (detailedReport){
                const writeDetails = createArrayCsvWriter({
                    path: `${filePath}/k8s_host_detail_${d.getTime()}.csv`
                });
                const processDetailData = async () => {
                    for (let v in k8shosts) {
                        detailData.push([k8shosts[v].entityId, ...k8shosts[v].rawMem]);
                    }
                }
                processDetailData().then(() => { writeDetails.writeRecords(detailData)
                    .then(() => { console.log('Detail report complete.'); }).catch((e) => { console.log(e); });
                }).catch((e) => { console.log(e); });
            }
        }).catch((error) => {console.log(error)});
    }).catch(function (error) {
        // handle error
        console.log(error);
    });
}
module.exports = {
    server_report: server_report,
};