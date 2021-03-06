const audit_records = (con) => {
    return new Promise ((resolve) => {
        console.log(new Date(), "Fetching audit report");
 
        // fetch and collate host data
        let q = `SELECT timestamp,count(*) AS num_records FROM tbl_hostmemdata GROUP BY timestamp ORDER BY timestamp ASC`;
        con.query(q, function (err, res) {
            if (err) throw err;
            let r_data = {}
            for (let i of res){
                let d = new Date(i.timestamp);
                let fd = `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`
                if (r_data.hasOwnProperty(fd)){
                    r_data[fd].hours += 1;
                    r_data[fd].records += i.num_records;
                    let d = new Date(i.timestamp);
                    d.setUTCHours(d.getUTCHours() - 1);
                    r_data[fd].detail[d.getUTCHours()] = i.num_records;
                } else {
                    r_data[fd] = {};
                    r_data[fd].hours = 1;
                    r_data[fd].records = i.num_records;
                    r_data[fd].detail = {};
                    let d = new Date(i.timestamp);
                    d.setUTCHours(d.getUTCHours() - 1);
                    r_data[fd].detail[d.getUTCHours()] = i.num_records;
                }
            }
            resolve(r_data);
        });
    });
 }
 module.exports = {
     audit_records: audit_records,
 };