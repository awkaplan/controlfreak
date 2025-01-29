FROM ruby:3.2-slim-bullseye as builder

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends build-essential && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Gemfile* ./
RUN bundle install --jobs=4 --retry=3

FROM ruby:3.2-slim-bullseye

WORKDIR /app
COPY --from=builder /usr/local/bundle /usr/local/bundle
COPY . .

EXPOSE 4000
CMD ["bundle", "exec", "jekyll", "serve", "--host", "0.0.0.0"]
