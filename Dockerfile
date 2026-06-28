FROM node:20 AS frontend-build
WORKDIR /app/frontend
COPY PropertyMatch.API/frontend/package*.json ./
RUN npm install
COPY PropertyMatch.API/frontend/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY PropertyMatch.API/ ./
COPY --from=frontend-build /app/frontend/dist ./wwwroot/
RUN dotnet publish PropertyMatch.API.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "PropertyMatch.API.dll"]