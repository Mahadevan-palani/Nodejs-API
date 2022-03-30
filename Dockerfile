# base image
FROM node:12.2.0

# set working directory
WORKDIR /bnx-depository

# copy the built binary into the docker container
COPY depository-service /bnx-depository

# change permission to execute the binary
RUN chmod 777 depository-service

# open the port 8082 of the container to listen from the host port 8082
EXPOSE 8082

# start the depository service
CMD ./depository-service
