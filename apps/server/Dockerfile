# ─── Stage 1: Chef ─────────────────────────────────────────────────────────────
# cargo-chef computes a "recipe" of dependencies, enabling proper Docker layer
# caching so that deps are only rebuilt when Cargo.toml/Cargo.lock change.
FROM rust:bookworm AS chef

RUN cargo install cargo-chef --locked
RUN apt-get update && apt-get install -y --no-install-recommends \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    libavfilter-dev \
    libavdevice-dev \
    libswscale-dev \
    libswresample-dev \
    pkg-config \
    clang \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ─── Stage 2: Planner ─────────────────────────────────────────────────────────
# Generates the dependency recipe from your source tree
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# ─── Stage 3: Builder ─────────────────────────────────────────────────────────
# Builds dependencies first (cached layer), then the actual app
FROM chef AS builder

# Build deps only — this layer is cached as long as recipe.json doesn't change
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

# Now build the actual application
COPY . .
RUN cargo build --release

# ─── Stage 4: Runtime ─────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/crabdrop .

EXPOSE 3001

CMD ["./crabdrop"]
