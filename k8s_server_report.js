const server_report = (tenantURL, apiKey, tags, filePath, huFactor, percentileCutoff, detailedReport) => {
    // Load required packages
    const axios = require('axios'); // for making http calls
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
    let removeHosts = []; // list of k8s hosts with no memory metrics for the period
    let detailData = []; // fow raw data report when detailedReport is enabled

    // get start and end timestamps based on last month
    const d = new Date();
    d.setMonth(d.getMonth() - 1)
    const y = d.getFullYear(), m = d.getMonth();
    const from = (new Date(y, m, 1)).getTime();
    const to = (new Date(y, m + 1, 0)).getTime();

    // Helper function to decide if a host should be included or not
    // This can easily be modified without having to touch core app logic
    // Currently using the "Technologies" host property to find k8s nodes
    const includeHost = (techs) => {
        // Loop through tech and see if k8s is there
        try {
            for (let tech of techs){
                if (tech.type.toUpperCase() === 'KUBERNETES')
                    return true; // node is k8s node
            }
        } catch (e) { /* no techs for this host */ }
        return false; // node is not k8s
    }

    // Fetch hosts running k8s
    apiURI = `/api/v1/entity/infrastructure/hosts?showMonitoringCandidates=false${tags}`;
    axios.get(`${tenantURL}${apiURI}`, {'headers': headers}).then(function (response) {
        // handle success
        for (let host of response.data){
            // if the host matches our include criteria and is full stack, add it to the list along with details needed later
            if (includeHost(host.softwareTechnologies) && host.monitoringMode.toUpperCase() === 'FULL_STACK'){
                k8shosts.push({
                    'entityId': host.entityId,
                    'displayName': host.displayName,
                    'consumedHostUnits': host.consumedHostUnits
                });
            }
        }
    }).catch(function (error) {
        // handle error
        console.log(error.message);
    }).finally(function () {
        // Fetch metrics for memory utilization
        apiURI = '/api/v2/metrics/query'
        let queryString = `?metricSelector=builtin:host.mem.used:max&resolution=1h&from=${from}&to=${to}`;
        let nextKey = null; // to track next page key so we can handle pagination
        axios.get(`${tenantURL}${apiURI}${queryString}&pageSize=100`, {'headers': headers}).then(function (response) {
            nextKey = response.data.nextPageKey;
            if (detailedReport) {
                let line = ['', ...response.data.result[0].data[0].timestamps];
                detailData.push(line);
            }
            // loop through metrics and store results for our k8s hosts
            for (let host of response.data.result[0].data){
                let x = k8shosts.findIndex((i) => i.entityId == host.dimensions[0]);
                if (x > -1){
                    k8shosts[x].memory = percentile(percentileCutoff, host.values.filter((obj) => obj )); // trimming out null values
                    if(detailedReport){
                        detailData.push([k8shosts[x].entityId, ...host.values]);
                    }
                }
            }
        }).catch(function (error){
            // handle error
            console.log(error.message);
        }).finally(function () {
            const fetchNext = (k) => {
                axios.get(`${tenantURL}${apiURI}?nextPageKey=${k}`, {'headers': headers}).then(function (response) {
                    // loop through metrics and store results for our k8s hosts
                    for (let host of response.data.result[0].data){
                        let x = k8shosts.findIndex((i) => i.entityId == host.dimensions[0]);
                        if (x > -1){
                            k8shosts[x].memory = percentile(percentileCutoff, host.values.filter((obj) => obj )); // trimming out null values
                            if(detailedReport){
                                detailData.push([k8shosts[x].entityId, ...host.values]);
                            }
                        }
                    }
                    k = response.data.nextPageKey;
                }).catch(function(error){
                    // handle error
                    console.log(error.message);
                    return null;
                }).finally(() => { return k });
            }
            // loop function wrapped in promise, so we can wait to continue until we've run all the needed api calls
            const loopy = () => {
                return new Promise(resolve => {
                    while(nextKey != null){
                        nextKey = fetchNext(nextKey);
                    }
                    resolve();
                })
            }
            // run the loop then continue
            loopy().then(() => {
                // calculate HUs and drop into a CSV
                // convert bytes to gb, calc HU and calulate totals
                for (let host in k8shosts){
                    // if there's no memory metrics for the host, it wasn't running during the period
                    if (k8shosts[host].hasOwnProperty('memory')){
                        let memInGb = parseFloat((k8shosts[host].memory / 1073741824).toFixed(2));
                        let hu = Math.ceil(memInGb / huFactor);
                        hu = hu > k8shosts[host].consumedHostUnits ? k8shosts[host].consumedHostUnits : hu; // in case host is at or near capacity
                        k8shosts[host].memory = memInGb;
                        totalMem += memInGb;
                        k8shosts[host].hostUnits = hu;
                        totalHU += hu;
                        totalOldHU += k8shosts[host].consumedHostUnits;
                    } else { removeHosts.push(host) }
                }
            }).catch((error) => {console.log(error.message)}).finally(() => {
                // stage csv, add totals and dump everything to a file
                for (let x = removeHosts.length -1; x > -1; x--){
                    k8shosts.splice(removeHosts[x],1);
                }
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
            });
        });
    });
}
module.exports = {
    server_report: server_report,
};