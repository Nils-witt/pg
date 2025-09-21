FROM python:3.13-slim

WORKDIR /python-docker

COPY requirements.txt requirements.txt
RUN apt-get update && apt-get install libgdal-dev build-essential gcc -y --no-install-recommends
RUN pip3 install -r requirements.txt

COPY . .
EXPOSE 8000

CMD [ "gunicorn","-w","4","-b", "0.0.0.0","app:app"]