"""
Tests for the Proof of Humanity API endpoints.
"""

import json
import pytest
from unittest.mock import patch, MagicMock

def test_get_family_tree_unauthenticated(client):
    """Test getting family tree without authentication."""
    response = client.get('/api/family/tree')
    assert response.status_code == 401

def test_get_family_tree_authenticated(client, auth):
    """Test getting family tree with authentication."""
    headers = auth.get_auth_headers()
    response = client.get('/api/family/tree', headers=headers)
    assert response.status_code == 200
    assert 'family_tree' in response.json

def test_add_family_relationship(client, auth):
    """Test adding a new family relationship."""
    auth.login()
    
    with patch('routes.api.family.add_family_relationship', return_value=1):
        response = client.post('/api/family/relationship', 
                               data=json.dumps({
                                   'relative_id': 2,
                                   'relationship_type': 'friend'
                               }),
                               content_type='application/json')
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['id'] == 1
        assert data['relative_id'] == 2
        assert data['relationship_type'] == 'friend'

def test_add_family_relationship_invalid_data(client, auth):
    """Test adding a family relationship with invalid data."""
    headers = auth.get_auth_headers()
    response = client.post('/api/family/relationship', json={}, headers=headers)
    assert response.status_code == 400
    assert 'error' in response.json

def test_verify_relationship(client, auth):
    """Test verifying a family relationship."""
    auth.login()
    
    with patch('routes.api.family.verify_relationship', return_value=True):
        response = client.put('/family/verify/1')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['message'] == 'Relationship verified successfully'

def test_verify_nonexistent_relationship(client, auth):
    """Test verifying a relationship that doesn't exist."""
    auth.login()
    
    with patch('routes.api.family.verify_relationship', side_effect=ValueError("Relationship not found")):
        response = client.put('/family/verify/999')
        
        assert response.status_code == 404
        data = json.loads(response.data)
        assert 'error' in data

def test_remove_relationship(client, auth):
    """Test removing a family relationship."""
    headers = auth.get_auth_headers()
    response = client.delete('/api/family/relationship/rel123', headers=headers)
    assert response.status_code == 200
    assert response.json['message'] == 'Relationship removed successfully'

def test_search_family_members(client, auth):
    """Test searching for family members."""
    auth.login()
    
    with patch('routes.api.family.search_family_members', return_value=[
        {'id': 2, 'name': 'John Doe', 'verification_level': 2},
        {'id': 3, 'name': 'Jane Doe', 'verification_level': 1}
    ]):
        response = client.get('/api/family/search?q=doe')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) == 2
        assert data[0]['name'] == 'John Doe'

def test_get_verification_requests(client, auth):
    """Test retrieving verification requests."""
    auth.login()
    
    with patch('routes.api.verification.get_verification_requests', return_value=[
        {'id': 1, 'request_type': 'identity', 'status': 'pending'},
        {'id': 2, 'request_type': 'identity', 'status': 'approved'}
    ]):
        response = client.get('/api/verification/requests')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) == 2
        assert data[0]['request_type'] == 'identity'

def test_create_verification_request(client, auth):
    """Test creating a verification request."""
    headers = auth.get_auth_headers()
    data = {
        'request_type': 'identity',
        'metadata': {'document_type': 'passport'}
    }
    response = client.post('/api/verification/request', json=data, headers=headers)
    assert response.status_code == 201
    assert 'request_id' in response.json

def test_update_verification_request(client, auth):
    """Test updating a verification request status."""
    # Login as admin user who can approve requests
    auth.login(username='testadmin', password='password')
    
    with patch('routes.api.verification.update_verification_request', return_value=True):
        response = client.put('/family/verification/request/1', 
                             data=json.dumps({
                                 'status': 'approved',
                                 'notes': 'Identity verified through video call'
                             }),
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['message'] == 'Verification request updated'

def test_unauthorized_verification_update(client, auth):
    """Test that non-admin users cannot update verification requests."""
    # Login as regular user
    auth.login()
    
    response = client.put('/family/verification/request/1', 
                         data=json.dumps({
                             'status': 'approved',
                             'notes': 'Self-approval attempt'
                         }),
                         content_type='application/json')
    
    assert response.status_code == 403
    data = json.loads(response.data)
    assert 'error' in data

def test_get_did_document(client):
    """Test getting a DID document."""
    response = client.get('/api/did/document/1234567890abcdef')
    assert response.status_code == 200
    assert 'id' in response.json

def test_update_did_document(client, auth):
    """Test updating a DID document."""
    headers = auth.get_auth_headers()
    data = {
        'publicKey': 'new_public_key_123'
    }
    response = client.put('/api/did/document/1234567890abcdef', json=data, headers=headers)
    assert response.status_code == 200
    assert response.json['message'] == 'DID document updated successfully'

def test_api_rate_limiting(client):
    """Test that API rate limiting is enforced."""
    # Make multiple rapid requests to trigger rate limiting
    for _ in range(10):
        client.get('/family/tree')
    
    # The next request should be rate limited
    response = client.get('/family/tree')
    assert response.status_code == 429
    data = json.loads(response.data)
    assert 'error' in data
    assert 'rate limit' in data['error'].lower()

def test_api_cors_headers(client):
    """Test CORS headers are present in API responses."""
    response = client.options('/api/family/tree')
    assert response.status_code == 200
    assert 'Access-Control-Allow-Origin' in response.headers
    assert 'Access-Control-Allow-Methods' in response.headers
    assert 'Access-Control-Allow-Headers' in response.headers 