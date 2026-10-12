FROM python:3.13
WORKDIR /app
COPY . .
RUN pip install flask psycopg2 redis
ENV FLASK_ENV=development
EXPOSE 5000
CMD ["flask", "run", "--host=0.0.0.0"]

