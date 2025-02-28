import requests
import json

# Define the target URL
url = "https://greytheferal.app.n8n.cloud/webhook-test/execute-query"

# Define the payload
payload = {
    "query": "SELECT user_id, full_name, email \nFROM users \nLIMIT 100;"
}

# Send the POST request
response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})

# Print the response
print("Status Code:", response.status_code)
print("Response Body:", response.text)
