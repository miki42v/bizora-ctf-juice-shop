FROM bkimminich/juice-shop:v20.2.0
COPY --chown=0:0 gateway.cjs loopback.cjs /gateway/
EXPOSE 10000
CMD ["/gateway/gateway.cjs"]
