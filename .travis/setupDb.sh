#!/bin/bash

case "$NODE_ENV" in
  "mysql")
    docker run -d --rm --name queue-knex-db -p 7000:3306 \
      -e MYSQL_DATABASE=test \
      -e MYSQL_USER=test \
      -e MYSQL_PASSWORD=test \
      -e MYSQL_RANDOM_ROOT_PASSWORD=1 \
      mysql
    ;;

  "mysql5")
    docker run -d --rm --name queue-knex-db -p 7000:3306 \
      -e MYSQL_DATABASE=test \
      -e MYSQL_USER=test \
      -e MYSQL_PASSWORD=test \
      -e MYSQL_RANDOM_ROOT_PASSWORD=1 \
      mysql:5
    ;;

  "postgres")
    docker run -d --rm --name queue-knex-db -p 7000:5432 \
      -e POSTGRES_USER=test \
      -e POSTGRES_USER=test \
      -e POSTGRES_PASSWORD=test \
      postgres:alpine
    ;;

  "postgres9")
    docker run -d --rm --name queue-knex-db -p 7000:5432 \
      -e POSTGRES_USER=test \
      -e POSTGRES_USER=test \
      -e POSTGRES_PASSWORD=test \
      postgres:9-alpine
    ;;

  *)
    ;;
esac

sleep 10
