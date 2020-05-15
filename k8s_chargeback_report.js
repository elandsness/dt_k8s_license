const chargeback_report = (tenantURL, apiKey, tags, filePath) => {
    // Load required packages
    const axios = require('axios'); // for making http calls
    const createCsvWriter = require('csv-writer').createObjectCsvWriter; // for building csv

    // Setup variables
    const headers = {
        'Authorization': `Api-Token ${apiKey}`,
        'Accept': 'application/json'
    }; // headers used during api calls
    let containers = []; // array to store list of containers
    let namespaces = []; // array to store list of namespaces with memory totals
    let apiURI = ''; // used to stage api endpoints before querying
    let totalMem = 0; // to calculate total memory

    // helper function to average values in an array
    const arrAvg = arr => arr.reduce((a,b) => a + b, 0) / arr.length

    // get start and end timestamps based on last month
    const d = new Date();
    const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
    const from = (new Date(y, m, day - 1)).getTime();
    const to = (new Date(y, m, day)).getTime();

    // Helper function to decide if a container should be included or not
    // This can easily be modified without having to touch core app logic
    // Currently looking for a namespace property for the container
    const includeContainer = (data) => {
        try {
            if (data.hasOwnProperty("kubernetesNamespaces"))
                return true; // process has a namespace
        } catch (e) { /* no namespace for this container */ }
        return false; // container has no namespaces
    }

    // Fetch containers running in k8s
    apiURI = `/api/v1/entity/infrastructure/processes?includeDetails=true${tags}`;
    axios.get(`${tenantURL}${apiURI}`, {'headers': headers}).then(function (response) {
        // handle success
        for (let pgi of response.data){
            // if the pgi matches our include criteria add it to the list along with details needed later
            if (includeContainer(pgi.metadata)){
                containers.push({
                    'entityId': pgi.entityId,
                    'displayName': pgi.displayName,
                    'namespaces': pgi.metadata.kubernetesNamespaces.join(', ')
                });
                // if we haven't grabbed this namespace yet, then do so
                let x = namespaces.findIndex((i) => i.namespace == pgi.metadata.kubernetesNamespaces.join(', '));
                if (x < 0){
                    namespaces.push({
                        'namespace': pgi.metadata.kubernetesNamespaces.join(', '),
                        'memory': 0
                    });
                }
            }
        }
    }).catch(function (error) {
        // handle error
        console.log(error.message);
    }).finally(function () {
        // Fetch metrics for memory utilization
        apiURI = '/api/v2/metrics/query'
        let queryString = `?metricSelector=builtin:tech.generic.mem.workingSetSize:avg&resolution=1h&from=${from}&to=${to}`;
        let nextKey = null; // to track next page key so we can handle pagination
        axios.get(`${tenantURL}${apiURI}${queryString}&pageSize=1000`, {'headers': headers}).then(function (response) {
            nextKey = response.data.nextPageKey;
            // loop through metrics and store results for our k8s hosts
            for (let pgi of response.data.result[0].data){
                let x = containers.findIndex((i) => i.entityId == pgi.dimensions[0]);
                if (x > -1){
                    containers[x].memory = arrAvg(pgi.values.filter((obj) => obj == null ? 0 : obj )); // convert null to zero and average
                    let ns = namespaces.findIndex((i) => i.namespace == containers[x].namespaces);
                    namespaces[ns].memory += containers[x].memory;
                }
            }
        }).catch(function (error){
            // handle error
            console.log(error.message);
        }).finally(function () {
            const fetchNext = (k) => {
                axios.get(`${tenantURL}${apiURI}?nextPageKey=${k}`, {'headers': headers}).then(function (response) {
                    // loop through metrics and store results for our k8s hosts
                    for (let pgi of response.data.result[0].data){
                        let x = containers.findIndex((i) => i.entityId == pgi.dimensions[0]);
                        if (x > -1){
                            containers[x].memory = arrAvg(pgi.values.filter((obj) => obj == null ? 0 : obj )); // convert null to zero and average
                            let ns = namespaces.findIndex((i) => i.namespace == containers[x].namespaces);
                            namespaces[ns].memory += containers[x].memory;
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
                // convert bytes to gb and calulate totals
                for (let pgi in containers){
                    // if there's no memory metrics for the process, it wasn't running during the period
                    if (containers[pgi].hasOwnProperty('memory')){
                        let memInGb = parseFloat((containers[pgi].memory / 1073741824).toFixed(4));
                        containers[pgi].memory = memInGb;
                        totalMem += memInGb;
                    } else { containers[pgi].memory = 0 }
                }
                for (let ns in namespaces){
                    if (namespaces[ns].hasOwnProperty('memory')){
                        namespaces[ns].memory = parseFloat((namespaces[ns].memory / 1073741824).toFixed(4));
                    }
                }
            }).catch((error) => {console.log(error.message)}).finally(() => {
                // stage csv, add totals and dump everything to a file
                const totals = [{
                    'entityId': 'TOTALS',
                    'displayName': '',
                    'memory': totalMem,
                    'namespace(s)': ''
                }]
                const csvWriter = createCsvWriter({
                    path: `${filePath}/k8s_containers_${d.getTime()}.csv`,
                    header: [
                        {id: 'entityId', title: 'DT_ID'},
                        {id: 'displayName', title: 'CONTAINER'},
                        {id: 'memory', title: 'MEM_GB'},
                        {id: 'namespaces', title: 'NAMESPACE'}
                    ]
                });
                csvWriter.writeRecords(containers)
                .then(() => {
                    csvWriter.writeRecords(totals)
                    .then(() => {
                        console.log('Container report completed.');
                    }).catch((e) => { console.log(e.message); });
                }).catch((e) => { console.log(e.message); });

                // prep and write the namespace report
                const writeNs = createCsvWriter({
                    path: `${filePath}/k8s_namespaces_${d.getTime()}.csv`,
                    header: [
                        {id: 'namespace', title: 'NAMESPACE'},
                        {id: 'memory', title: 'MEM_GB'}
                    ]
                });
                writeNs.writeRecords(namespaces)
                .then(() => {
                    console.log('Namespace report completed.');
                }).catch((e) => { console.log(e.message); });
            });
        });
    });
}
module.exports = {
    chargeback_report: chargeback_report,
};