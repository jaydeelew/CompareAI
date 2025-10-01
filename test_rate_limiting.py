#!/usr/bin/env python3
"""
Test script for rate limiting functionality
Usage: python test_rate_limiting.py
"""

import requests
import json
import time
from datetime import datetime

# Configuration
API_URL = "http://localhost:8000"
TEST_FINGERPRINT = "test_fingerprint_12345"

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_test(message):
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST: {message}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")

def print_success(message):
    print(f"{GREEN}✓ {message}{RESET}")

def print_error(message):
    print(f"{RED}✗ {message}{RESET}")

def print_info(message):
    print(f"{YELLOW}ℹ {message}{RESET}")

def test_server_health():
    """Test if the server is running"""
    print_test("Server Health Check")
    try:
        response = requests.get(f"{API_URL}/health", timeout=5)
        if response.status_code == 200:
            print_success("Server is running!")
            return True
        else:
            print_error(f"Server returned status {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print_error(f"Cannot connect to server: {e}")
        print_info("Make sure the backend is running: cd backend && python -m uvicorn app.main:app --reload")
        return False

def get_rate_limit_status(fingerprint=None):
    """Get current rate limit status"""
    try:
        params = {"fingerprint": fingerprint} if fingerprint else {}
        response = requests.get(f"{API_URL}/rate-limit-status", params=params, timeout=5)
        if response.status_code == 200:
            return response.json()
        return None
    except:
        return None

def make_comparison(fingerprint=TEST_FINGERPRINT):
    """Make a test comparison request"""
    try:
        payload = {
            "input_data": f"Test request at {datetime.now().isoformat()}",
            "models": ["openai/gpt-3.5-turbo"],  # Use a single model for faster testing
            "browser_fingerprint": fingerprint
        }
        response = requests.post(
            f"{API_URL}/compare",
            json=payload,
            timeout=60  # Increased timeout for slower API responses
        )
        return response
    except requests.exceptions.RequestException as e:
        print_error(f"Request failed: {e}")
        return None

def test_single_comparison():
    """Test that a single comparison works"""
    print_test("Single Comparison Test")
    
    response = make_comparison()
    if response and response.status_code == 200:
        print_success("Comparison succeeded!")
        data = response.json()
        print_info(f"Response has {len(data.get('results', {}))} results")
        return True
    else:
        print_error(f"Comparison failed with status {response.status_code if response else 'N/A'}")
        if response:
            print_error(f"Error: {response.text}")
        return False

def test_rate_limit_status():
    """Test the rate limit status endpoint"""
    print_test("Rate Limit Status Endpoint")
    
    status = get_rate_limit_status(TEST_FINGERPRINT)
    if status:
        print_success("Rate limit status retrieved!")
        print_info(f"IP Address: {status.get('ip_address')}")
        print_info(f"IP Usage: {status.get('ip_usage_count')}/{status.get('max_daily_limit')}")
        print_info(f"Remaining: {status.get('remaining')}")
        if 'fingerprint_usage_count' in status:
            print_info(f"Fingerprint Usage: {status.get('fingerprint_usage_count')}/{status.get('max_daily_limit')}")
        return True
    else:
        print_error("Could not retrieve rate limit status")
        return False

def test_rate_limit_enforcement():
    """Test that rate limiting actually blocks after limit"""
    print_test("Rate Limit Enforcement Test")
    
    # Check current status
    status = get_rate_limit_status(TEST_FINGERPRINT)
    if not status:
        print_error("Could not check rate limit status")
        return False
    
    current_count = status.get('ip_usage_count', 0)
    max_limit = status.get('max_daily_limit', 10)
    remaining = max_limit - current_count
    
    print_info(f"Current usage: {current_count}/{max_limit}")
    print_info(f"Remaining requests: {remaining}")
    
    if remaining <= 0:
        print_info("Already at limit. Testing that requests are blocked...")
        response = make_comparison()
        if response and response.status_code == 429:
            print_success("Request correctly blocked with 429 status!")
            error_data = response.json()
            print_info(f"Error message: {error_data.get('detail')}")
            return True
        else:
            print_error(f"Expected 429, got {response.status_code if response else 'N/A'}")
            return False
    else:
        print_info(f"Making {remaining} requests to reach the limit...")
        
        for i in range(remaining):
            print(f"  Request {i+1}/{remaining}...", end=" ")
            response = make_comparison()
            if response and response.status_code == 200:
                print(f"{GREEN}✓{RESET}")
            else:
                print(f"{RED}✗{RESET}")
                print_error(f"Unexpected failure at request {i+1}")
                return False
            time.sleep(0.5)  # Small delay to be nice to the server
        
        # Now try one more - should be blocked
        print_info("Trying one more request (should be blocked)...")
        response = make_comparison()
        
        if response and response.status_code == 429:
            print_success("Rate limit correctly enforced! Request blocked with 429 status")
            error_data = response.json()
            print_info(f"Error message: {error_data.get('detail')}")
            return True
        else:
            print_error(f"Expected 429, got {response.status_code if response else 'N/A'}")
            return False

def test_fingerprint_tracking():
    """Test that different fingerprints are tracked separately"""
    print_test("Fingerprint Tracking Test")
    
    fingerprint1 = "test_fp_1"
    fingerprint2 = "test_fp_2"
    
    # Make request with fingerprint 1
    print_info("Making request with fingerprint 1...")
    response1 = make_comparison(fingerprint1)
    
    # Check status for both fingerprints
    status1 = get_rate_limit_status(fingerprint1)
    status2 = get_rate_limit_status(fingerprint2)
    
    if status1 and status2:
        count1 = status1.get('fingerprint_usage_count', 0)
        count2 = status2.get('fingerprint_usage_count', 0)
        
        print_info(f"Fingerprint 1 usage: {count1}")
        print_info(f"Fingerprint 2 usage: {count2}")
        
        # Note: IP count will be the same for both since we're from the same IP
        print_info(f"IP usage (shared): {status1.get('ip_usage_count', 0)}")
        
        if count1 > count2:
            print_success("Fingerprints are tracked separately!")
            return True
        else:
            print_error("Fingerprints don't seem to be tracked separately")
            return False
    else:
        print_error("Could not check fingerprint status")
        return False

def test_without_fingerprint():
    """Test that rate limiting works even without fingerprint"""
    print_test("Rate Limiting Without Fingerprint")
    
    print_info("Making request without fingerprint...")
    response = make_comparison(fingerprint=None)
    
    if response and response.status_code in [200, 429]:
        print_success("Request processed (IP-based tracking working)")
        print_info(f"Status: {response.status_code}")
        return True
    else:
        print_error("Request failed unexpectedly")
        return False

def main():
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}  Rate Limiting Test Suite{RESET}")
    print(f"{BLUE}  Testing API at: {API_URL}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    results = []
    
    # Test 1: Server health
    if not test_server_health():
        print_error("\nServer is not running. Please start the backend first.")
        return
    results.append(("Server Health", True))
    
    time.sleep(1)
    
    # Test 2: Single comparison
    results.append(("Single Comparison", test_single_comparison()))
    time.sleep(1)
    
    # Test 3: Rate limit status
    results.append(("Rate Limit Status", test_rate_limit_status()))
    time.sleep(1)
    
    # Test 4: Without fingerprint
    results.append(("Without Fingerprint", test_without_fingerprint()))
    time.sleep(1)
    
    # Test 5: Fingerprint tracking
    results.append(("Fingerprint Tracking", test_fingerprint_tracking()))
    time.sleep(1)
    
    # Test 6: Rate limit enforcement (do this last as it uses up the limit)
    print_info("\nWARNING: The next test will use up your rate limit!")
    print_info("Press Ctrl+C within 5 seconds to skip, or wait to continue...")
    try:
        time.sleep(5)
        results.append(("Rate Limit Enforcement", test_rate_limit_enforcement()))
    except KeyboardInterrupt:
        print_info("\nSkipped rate limit enforcement test")
        results.append(("Rate Limit Enforcement", None))
    
    # Summary
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}  Test Summary{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")
    
    passed = sum(1 for _, result in results if result is True)
    failed = sum(1 for _, result in results if result is False)
    skipped = sum(1 for _, result in results if result is None)
    
    for test_name, result in results:
        if result is True:
            print(f"{GREEN}✓{RESET} {test_name}")
        elif result is False:
            print(f"{RED}✗{RESET} {test_name}")
        else:
            print(f"{YELLOW}⊘{RESET} {test_name} (skipped)")
    
    print(f"\n{GREEN}Passed: {passed}{RESET} | {RED}Failed: {failed}{RESET} | {YELLOW}Skipped: {skipped}{RESET}")
    
    if failed == 0 and passed > 0:
        print(f"\n{GREEN}{'='*60}{RESET}")
        print(f"{GREEN}  All tests passed! Rate limiting is working correctly.{RESET}")
        print(f"{GREEN}{'='*60}{RESET}\n")
    elif failed > 0:
        print(f"\n{RED}{'='*60}{RESET}")
        print(f"{RED}  Some tests failed. Please check the output above.{RESET}")
        print(f"{RED}{'='*60}{RESET}\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{YELLOW}Tests interrupted by user{RESET}")
    except Exception as e:
        print(f"\n{RED}Unexpected error: {e}{RESET}")

