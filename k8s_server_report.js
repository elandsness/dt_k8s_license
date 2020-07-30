const server_report = (from, to, con) => {
    return new Promise ((resolve) => {
        // Load required packages
        const percentile = require("percentile"); // calculates percentiles
        const mysql = require('mysql'); // for connecting to db
        const createCsvStringifier = require('csv-writer').createObjectCsvStringifier; // for building the csv


        // Setup variables
        const F = 12; // gb ram per host unit
        const P = 99; // percentile used for calculations
        let data = {} // stages data before returning
        let trhu = 0, tahu = 0, tam = 0; // total reported hu, adj hu, and adj mem

        console.log(new Date(), "Running server report");

        // fetch the data
        let q = `SELECT host_id,
                    displayName,
                    consumedHostUnits,
                    timestamp,
                    SUM(memory) as memory
                FROM tbl_hostmemdata
                JOIN tbl_hostdata USING (host_id)
                WHERE timestamp >= ${from}
                AND timestamp <= ${to}
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
}
module.exports = {
    server_report: server_report,
};