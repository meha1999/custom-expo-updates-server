FROM node:20-bookworm-slim

WORKDIR /app

RUN corepack enable
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive

COPY . .

ENV NODE_ENV=production
ENV HOSTNAME=3000
ENV PRIVATE_KEY_PATH=code-signing-keys/private-key.pem
ENV NEXT_TELEMETRY_DISABLED=1

RUN yarn build

EXPOSE 3000

CMD ["yarn", "start"]
