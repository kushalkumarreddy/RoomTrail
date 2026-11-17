# ==========================================
# RoomTrail Backend Multi-Stage Production Dockerfile
# Stage 1: Build JAR using Maven with Java 21
# ==========================================
FROM maven:3.9.9-eclipse-temurin-21-jammy AS builder
WORKDIR /app

# Cache dependencies layer
COPY pom.xml ./
RUN mvn dependency:go-offline -B || true

# Copy source and build executable JAR
COPY src ./src
RUN mvn clean package -DskipTests=true -B

# ==========================================
# Stage 2: Production JRE 21 Minimal Runtime
# ==========================================
FROM eclipse-temurin:21-jre-jammy

# Create non-root application user for container security
RUN groupadd -r roomtrail && useradd -r -g roomtrail -u 1001 roomtrail

WORKDIR /app

# Copy only the compiled production JAR from builder
COPY --from=builder /app/target/roomtrail-backend-1.0.0.jar app.jar
RUN chown -R roomtrail:roomtrail /app

USER roomtrail:roomtrail

# Default environment configuration (Render overrides PORT and profile dynamically)
ENV PORT=8080
ENV SPRING_PROFILES_ACTIVE=prod

EXPOSE 8080

# Proper container startup command binding to dynamic Render $PORT and logging to stdout
ENTRYPOINT ["sh", "-c", "java -Dserver.port=${PORT:-8080} -Djava.security.egd=file:/dev/./urandom -jar app.jar"]
