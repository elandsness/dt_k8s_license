
#!/bin/bash
docker build -t k8sreport .

docker run --name k8sreport.db  \
--restart=unless-stopped  --hostname=k8sreport.db -p 3306:3306 -p 33060:33060  \
-e MYSQL_ROOT_HOST='%' -e MYSQL_ROOT_PASSWORD='rootpassword'   \
-d mysql/mysql-server:latest

docker run -p 8798:8798 -d --name=k8sreport.app --hostname=k8sreport.app --restart=unless-stopped --link=k8sreport.db  k8sreport
