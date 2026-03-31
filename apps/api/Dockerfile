FROM node:24-alpine

WORKDIR /workspace

COPY package.json package.json
COPY tsconfig.base.json tsconfig.base.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json

RUN npm install

COPY packages/shared packages/shared
COPY apps/api apps/api

WORKDIR /workspace/apps/api

EXPOSE 3001

CMD ["npm", "run", "dev"]
