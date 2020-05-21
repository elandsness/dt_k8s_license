const server_report = (tenantURL, apiKey, tags, filePath, huFactor, percentileCutoff, detailedReport) => {
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
    let k8shosts = []; // array to store list of k8s hosts
    let apiURI = ''; // used to stage api endpoints before querying
    let totalMem = 0, totalHU = 0; totalOldHU = 0; // to calculate total memory and HUs
    let detailData = []; // fow raw data report when detailedReport is enabled
    let nextKey = null; // to track next page key so we can handle pagination

    // get start and end timestamps based on last month
    const d = new Date();
    d.setMonth(d.getMonth() - 1)
    const y = d.getFullYear(), m = d.getMonth();
    const from = (new Date(y, m, 1)).getTime();
    const to = (new Date(y, m + 1, 0)).getTime();

    const threeDays = 3*24*60*60*1000;

    const fetchHost = async (timeframe) => {
        apiURI = `/api/v1/entity/infrastructure/hosts?showMonitoringCandidates=false${tags}`;
        let r = await fetch(`${tenantURL}${apiURI}${timeframe}`, {'headers': headers})
        let rj = await r.json()
        let tmp_hosts = await Promise.all(
            rj.map(async h => {
                if (h.hasOwnProperty('softwareTechnologies')){
                    for (let i of h.softwareTechnologies){
                        if (i.type.toUpperCase() == 'KUBERNETES' && h.monitoringMode.toUpperCase() === 'FULL_STACK'){
                            return {
                                'entityId': h.entityId,
                                'displayName': h.displayName,
                                'consumedHostUnits': h.consumedHostUnits
                            }
                        }
                    }
                }
            })
        )
        return await tmp_hosts.filter(function (el) {
            return el != null;
        });
    }
    // loop function wrapped in promise, so we can wait to continue until we've run all the needed api calls
    const loopHosts = async () => {
        let start = from, end = start + threeDays;
        return new Promise(async (resolve) => {
            while(start < to){
                k8shosts = k8shosts.concat(await fetchHost(`&startTimestamp=${start}&endTimestamp=${end}`));
                start += threeDays;
                end = (end + threeDays) > to ? to : end + threeDays;
            }
            resolve();
        })
    }
    // run the loop then continue
    loopHosts().then(async () => {
        // get rid of duplicates in the host list
        k8shosts = k8shosts.filter((v,i,a)=>a.findIndex(t=>(t.entityId === v.entityId))===i)
        // Fetch metrics for memory utilization
        apiURI = '/api/v2/metrics/query'
        let queryString = `?metricSelector=builtin:host.mem.used:max&resolution=1h&from=${from}&to=${to}`;
        let r = await fetch(`${tenantURL}${apiURI}${queryString}&pageSize=1000`, {'headers': headers})
        let rj = await r.json();
        nextKey = rj.nextPageKey;
        if (detailedReport) {
            let line = ['', ...rj.result[0].data[0].timestamps];
            detailData.push(line);
        }
        await Promise.all(
            rj.result[0].data.map(async h => {
                let x = await k8shosts.findIndex((i) => i.entityId == h.dimensions[0]);
                if (x > -1){
                    k8shosts[x].memory = percentile(percentileCutoff, h.values.filter((obj) => obj )); // trimming out null values
                    if(detailedReport){
                        detailData.push([k8shosts[x].entityId, ...h.values]);
                    }
                }
            })
        )
    }).then(async () => {
        const fetchNext = async (k) => {
            let r = await fetch(`${tenantURL}${apiURI}?nextPageKey=${k}`, {'headers': headers})
            let rj = await r.json();
            nextKey = rj.nextPageKey;
            await Promise.all(
                rj.result[0].data.map(async h => {
                    let x = await k8shosts.findIndex((i) => i.entityId == h.dimensions[0]);
                    if (x > -1){
                        k8shosts[x].memory = await percentile(percentileCutoff, h.values.filter((obj) => obj )); // trimming out null values
                        if(detailedReport){
                            detailData.push([k8shosts[x].entityId, ...h.values]);
                        }
                    }
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
            k8shosts.map(async (host) => {
                // if there's no memory metrics for the host, it wasn't running during the period
                if (host.hasOwnProperty('memory')){
                    let memInGb = parseFloat((host.memory / 1073741824).toFixed(2));
                    let hu = Math.ceil(memInGb / huFactor);
                    hu = hu > host.consumedHostUnits ? host.consumedHostUnits : hu; // in case host is at or near capacity
                    host.memory = memInGb;
                    totalMem += memInGb;
                    host.hostUnits = hu;
                    totalHU += hu;
                    totalOldHU += host.consumedHostUnits;
                }
            })
        }).catch((error) => {console.log(error.message)}).finally(async () => {
            // stage csv, add totals and dump everything to a file
            const totals = [{
                'entityId': 'TOTALS',
                'displayName': '',
                'memory': totalMem,
                'consumedHostUnits': totalOldHU,
                'hostUnits': totalHU
            }]
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
            csvWriter.writeRecords(k8shosts)
            .then(() => {
                csvWriter.writeRecords(totals)
                .then(() => {
                    console.log('Host unit report complete.');
                }).catch((e) => { console.log(e.message); });
            }).catch((e) => { console.log(e.message); });
            
            // if detailedReport, then write out the raw metrics
            if (detailedReport){
                const writeDetails = createArrayCsvWriter({
                    path: `${filePath}/k8s_host_detail_${d.getTime()}.csv`
                });
                writeDetails.writeRecords(detailData)
                .then(() => {
                    console.log('Detail report complete.');
                }).catch((e) => { console.log(e.message); });
            }
        }).catch((error) => {console.log(error.message)});
    }).catch(function (error) {
        // handle error
        console.log(error.message);
    });
}
module.exports = {
    server_report: server_report,
};