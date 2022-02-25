const chargeback_report = (from, to, con) => {
    return new Promise ((resolve) => {
        // Load required packages
        const createCsvStringifier = require('csv-writer').createObjectCsvStringifier; // for building the csv
        const fetch = require('node-fetch'); // for making http calls

        // Setup variables
        let data = {} // stages data before returning
        let ts = [{id:'namespace', title:'Namespace'}] // stages headers for csv

        console.log(new Date(), "Running charegeback report");

        (async () => {
            // fetch the data
            let q = `SELECT namespaces,
                    timestamp,
                    SUM(memory) as memory
                FROM tbl_nsmemdata
                WHERE timestamp BETWEEN ${from} AND ${to}
                GROUP BY namespaces, timestamp
                ORDER BY timestamp`;
            con.query(q, function (err, res) {
            if (err) throw err;
            for (let x of res){
                if (data.hasOwnProperty(x.namespaces)){
                    data[x.namespaces][x.timestamp] = x.memory;
                } else {
                    data[x.namespaces] = {
                        'namespace': x.namespaces,
                        [x.timestamp]:x.memory
                    }
                }
                let tmpd = new Date(x.timestamp);
                let tmpfd = `${tmpd.getMonth() + 1}/${tmpd.getDate()}/${tmpd.getFullYear()} ${
                    tmpd.getHours() < 10 ? `0${tmpd.getHours()}`: tmpd.getHours()}:00`;
                let exists = ts.find(o => o.id === x.timestamp);
                console.log(exists);
                if (!exists){
                    ts.push({id: x.timestamp, title: tmpfd});
                }
            }

            //create the csv
            const csvStringifier = createCsvStringifier({
                header: ts
            });
            console.log(ts);
            //console.log(data);
            resolve(csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(Object.values(data)));
            });
        })().catch(e => { console.log(new Date(), e); });

    });
}

module.exports = {
    chargeback_report: chargeback_report,
};

