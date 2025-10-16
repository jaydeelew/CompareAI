import requests
import json

url = "http://localhost:8000/auth/register"
data = {
    "email": "testuser789@example.com",
    "password": "Test1234"
}

try:
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    if response.status_code == 201:
        print("✅ Registration successful!")
        print(json.dumps(response.json(), indent=2))
    else:
        print(f"❌ Registration failed")
except Exception as e:
    print(f"Error: {e}")

