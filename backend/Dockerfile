# Build and run the Smart Business OS backend (for Render or any Docker host).
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -q -B dependency:go-offline
COPY src src
RUN ./mvnw -q -B package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
# Run as an ordinary user, not root: a bug in the app cannot then change the container's system files.
RUN groupadd --system app && useradd --system --gid app --uid 10001 --no-create-home app
COPY --from=build --chown=app:app /app/target/os-backend-*.jar app.jar
USER app
EXPOSE 8080
# Small-memory settings for Render's free plan (512 MB) and a faster start
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC -Xss512k -XX:TieredStopAtLevel=1"
ENTRYPOINT ["java", "-jar", "app.jar"]
