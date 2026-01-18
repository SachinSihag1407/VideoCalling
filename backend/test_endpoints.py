#!/usr/bin/env python3
"""Test script for all backend endpoints."""

import httpx
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def print_result(name: str, response):
    status = "✅" if response.status_code < 400 else "❌"
    print(f"{status} {name}: {response.status_code}")
    if response.status_code < 400:
        try:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2, default=str)[:500]}")
        except:
            print(f"   Response: {response.text[:200]}")
    else:
        print(f"   Error: {response.text[:200]}")
    print()

def main():
    print("=" * 60)
    print("Testing Doctor-Patient Interview Platform API")
    print("=" * 60)
    print()
    
    # Test 1: Health check
    print("1. Testing Health Endpoints")
    print("-" * 40)
    
    r = httpx.get(f"{BASE_URL}/")
    print_result("Root endpoint", r)
    
    r = httpx.get(f"{BASE_URL}/health")
    print_result("Health check", r)
    
    # Test 2: Authentication
    print("\n2. Testing Authentication")
    print("-" * 40)
    
    # Register a new patient
    r = httpx.post(f"{BASE_URL}/api/auth/register", json={
        "email": "test.patient@email.com",
        "full_name": "Test Patient",
        "role": "patient",
        "password": "testpass123"
    })
    print_result("Register new patient", r)
    
    # Login as existing patient
    r = httpx.post(f"{BASE_URL}/api/auth/login", data={
        "username": "patient1@email.com",
        "password": "patient123"
    })
    print_result("Login as patient", r)
    patient_token = r.json().get("access_token") if r.status_code == 200 else None
    
    # Login as existing doctor
    r = httpx.post(f"{BASE_URL}/api/auth/login", data={
        "username": "dr.smith@hospital.com",
        "password": "doctor123"
    })
    print_result("Login as doctor", r)
    doctor_token = r.json().get("access_token") if r.status_code == 200 else None
    
    # Get current user
    if patient_token:
        r = httpx.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {patient_token}"})
        print_result("Get current user (patient)", r)
    
    # List doctors
    if patient_token:
        r = httpx.get(f"{BASE_URL}/api/auth/doctors", headers={"Authorization": f"Bearer {patient_token}"})
        print_result("List doctors", r)
        doctors = r.json() if r.status_code == 200 else []
    
    # Test 3: Appointments
    print("\n3. Testing Appointments")
    print("-" * 40)
    
    doctor_id = None
    if patient_token and doctors:
        doctor_id = doctors[0]["id"]
        
        # Create appointment
        scheduled_time = (datetime.utcnow() + timedelta(days=1)).isoformat()
        r = httpx.post(f"{BASE_URL}/api/appointments/", 
            json={
                "doctor_id": doctor_id,
                "scheduled_time": scheduled_time,
                "reason": "Regular checkup",
                "notes": "First appointment"
            },
            headers={"Authorization": f"Bearer {patient_token}"}
        )
        print_result("Create appointment", r)
        appointment = r.json() if r.status_code == 201 else None
        
        # List appointments (patient)
        r = httpx.get(f"{BASE_URL}/api/appointments/", 
            headers={"Authorization": f"Bearer {patient_token}"}
        )
        print_result("List appointments (patient)", r)
        
        # List appointments (doctor)
        if doctor_token:
            r = httpx.get(f"{BASE_URL}/api/appointments/", 
                headers={"Authorization": f"Bearer {doctor_token}"}
            )
            print_result("List appointments (doctor)", r)
        
        if appointment:
            appointment_id = appointment["id"]
            
            # Get specific appointment
            r = httpx.get(f"{BASE_URL}/api/appointments/{appointment_id}", 
                headers={"Authorization": f"Bearer {patient_token}"}
            )
            print_result("Get appointment", r)
            
            # Update appointment (doctor confirms)
            if doctor_token:
                r = httpx.patch(f"{BASE_URL}/api/appointments/{appointment_id}", 
                    json={"status": "confirmed"},
                    headers={"Authorization": f"Bearer {doctor_token}"}
                )
                print_result("Confirm appointment (doctor)", r)
            
            # Get room ID
            r = httpx.get(f"{BASE_URL}/api/appointments/{appointment_id}/room", 
                headers={"Authorization": f"Bearer {patient_token}"}
            )
            print_result("Get appointment room", r)
            
            # Test 4: Consent
            print("\n4. Testing Consent")
            print("-" * 40)
            
            # Create consent request
            r = httpx.post(f"{BASE_URL}/api/consent/", 
                json={"appointment_id": appointment_id},
                headers={"Authorization": f"Bearer {patient_token}"}
            )
            print_result("Create consent request", r)
            
            # Get consent
            r = httpx.get(f"{BASE_URL}/api/consent/{appointment_id}", 
                headers={"Authorization": f"Bearer {patient_token}"}
            )
            print_result("Get consent", r)
            
            # Check consent status
            r = httpx.get(f"{BASE_URL}/api/consent/{appointment_id}/check", 
                headers={"Authorization": f"Bearer {patient_token}"}
            )
            print_result("Check consent (before grant)", r)
            
            # Grant consent (patient)
            r = httpx.patch(f"{BASE_URL}/api/consent/{appointment_id}", 
                json={"status": "granted"},
                headers={"Authorization": f"Bearer {patient_token}"}
            )
            print_result("Grant consent (patient)", r)
            
            # Check consent status again
            r = httpx.get(f"{BASE_URL}/api/consent/{appointment_id}/check", 
                headers={"Authorization": f"Bearer {patient_token}"}
            )
            print_result("Check consent (after grant)", r)
            
            # Test 5: Interviews
            print("\n5. Testing Interviews")
            print("-" * 40)
            
            # Create interview
            r = httpx.post(f"{BASE_URL}/api/interviews/", 
                json={"appointment_id": appointment_id},
                headers={"Authorization": f"Bearer {patient_token}"}
            )
            print_result("Create interview", r)
            
            # Start recording
            r = httpx.post(f"{BASE_URL}/api/interviews/{appointment_id}/start-recording", 
                headers={"Authorization": f"Bearer {doctor_token}"}
            )
            print_result("Start recording", r)
            
            # Stop recording
            r = httpx.post(f"{BASE_URL}/api/interviews/{appointment_id}/stop-recording", 
                headers={"Authorization": f"Bearer {doctor_token}"}
            )
            print_result("Stop recording", r)
            
            # Get interview
            r = httpx.get(f"{BASE_URL}/api/interviews/{appointment_id}", 
                headers={"Authorization": f"Bearer {patient_token}"}
            )
            print_result("Get interview", r)
            
            # List interviews
            r = httpx.get(f"{BASE_URL}/api/interviews/", 
                headers={"Authorization": f"Bearer {patient_token}"}
            )
            print_result("List interviews", r)
            
            # Get transcript
            r = httpx.get(f"{BASE_URL}/api/interviews/{appointment_id}/transcript", 
                headers={"Authorization": f"Bearer {patient_token}"}
            )
            print_result("Get transcript", r)
    
    # Test 6: Audit Logs
    print("\n6. Testing Audit Logs")
    print("-" * 40)
    
    if patient_token:
        r = httpx.get(f"{BASE_URL}/api/audit/", 
            headers={"Authorization": f"Bearer {patient_token}"}
        )
        print_result("List audit logs", r)
        
        r = httpx.get(f"{BASE_URL}/api/audit/my-activity", 
            headers={"Authorization": f"Bearer {patient_token}"}
        )
        print_result("Get my activity", r)
    
    # Test 7: API Documentation
    print("\n7. Testing API Documentation")
    print("-" * 40)
    
    r = httpx.get(f"{BASE_URL}/docs")
    print_result("Swagger UI available", r)
    
    r = httpx.get(f"{BASE_URL}/openapi.json")
    print_result("OpenAPI spec available", r)
    
    print("\n" + "=" * 60)
    print("All endpoint tests completed!")
    print("=" * 60)

if __name__ == "__main__":
    main()
