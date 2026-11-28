# Real Netflix Zuul (github.com/Netflix/zuul, its own zuul-sample app), built from source.
# Needs Java 21 (that's what this Zuul version requires).

# ---- Stage 1: clone + build ----
FROM eclipse-temurin:21-jdk AS build
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone --depth 1 --branch v4.1.10 https://github.com/Netflix/zuul.git .

# Our routing rules + config replace the sample's
COPY overrides/application.properties zuul-sample/src/main/resources/application.properties
COPY overrides/Routes.java zuul-sample/src/main/java/com/netflix/zuul/sample/filters/inbound/Routes.java
COPY overrides/OriginServerList.java zuul-sample/src/main/java/com/netflix/zuul/sample/filters/inbound/OriginServerList.java
# Don't let strict compiler checks (-Werror) break the build on our small edit
RUN sed -i '/-Werror/d' build.gradle
RUN echo 'dependencies { implementation "com.netflix.ribbon:ribbon-eureka:${versions_ribbon}" }' >> zuul-sample/build.gradle
RUN ./gradlew --no-daemon :zuul-sample:installDist -x test

# ---- Stage 2: runtime ----
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/zuul-sample/build/install/zuul-sample/ ./
EXPOSE 7001
ENTRYPOINT ["bin/zuul-sample"]
