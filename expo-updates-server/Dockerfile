FROM node:20-bookworm-slim

WORKDIR /app

RUN corepack enable
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive

COPY . .

ARG HOSTNAME=http://localhost:3000
ARG PRIVATE_KEY_PATH=code-signing-keys/private-key.pem
ARG DASHBOARD_ADMIN_USERNAME=admin
ARG DASHBOARD_ADMIN_PASSWORD

ENV NODE_ENV=production
ENV HOSTNAME=${HOSTNAME}
ENV PRIVATE_KEY_PATH=${PRIVATE_KEY_PATH}
ENV DASHBOARD_ADMIN_USERNAME=${DASHBOARD_ADMIN_USERNAME}
ENV DASHBOARD_ADMIN_PASSWORD=${DASHBOARD_ADMIN_PASSWORD}
ENV NEXT_TELEMETRY_DISABLED=1

RUN yarn build

EXPOSE 3000

CMD ["yarn", "start"]
