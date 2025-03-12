"""
Tests for WebRTC functionality in the Proof of Humanity application.
"""

import json
import pytest
from unittest.mock import patch, MagicMock

def test_create_video_session(client, auth):
    """Test creating a new WebRTC video session."""
    auth.login()
    
    # Mock data for the session
    mock_session_id = "test-session-12345"
    
    with patch('routes.api.webrtc.create_video_session', return_value=mock_session_id):
        response = client.post('/api/webrtc/session',
                              data=json.dumps({
                                  'peer_id': 2,
                                  'session_type': 'verification'
                              }),
                              content_type='application/json')
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert 'session_id' in data
        assert data['session_id'] == mock_session_id

def test_get_session_details(client, auth):
    """Test retrieving WebRTC session details."""
    auth.login()
    
    mock_session = {
        'id': 'test-session-12345',
        'user_id': 1,
        'peer_id': 2,
        'status': 'pending',
        'created_at': '2023-01-01T12:00:00',
        'ice_servers': json.dumps([
            {'urls': 'stun:stun.l.google.com:19302'}
        ])
    }
    
    with patch('routes.api.webrtc.get_session', return_value=mock_session):
        response = client.get('/api/webrtc/session/test-session-12345')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['id'] == mock_session['id']
        assert data['status'] == 'pending'
        assert 'ice_servers' in data

def test_session_not_found(client, auth):
    """Test retrieving a session that doesn't exist."""
    auth.login()
    
    with patch('routes.api.webrtc.get_session', return_value=None):
        response = client.get('/api/webrtc/session/nonexistent-session')
        
        assert response.status_code == 404
        data = json.loads(response.data)
        assert 'error' in data

def test_unauthorized_session_access(client, auth):
    """Test that a user cannot access another user's session."""
    auth.login()
    
    # Mock a session that belongs to another user
    mock_session = {
        'id': 'test-session-12345',
        'user_id': 3,  # Different from the logged-in user
        'peer_id': 2,
        'status': 'pending'
    }
    
    with patch('routes.api.webrtc.get_session', return_value=mock_session):
        with patch('routes.api.webrtc.get_current_user_id', return_value=1):
            response = client.get('/api/webrtc/session/test-session-12345')
            
            assert response.status_code == 403
            data = json.loads(response.data)
            assert 'error' in data

def test_exchange_signaling_message(client, auth):
    """Test exchanging WebRTC signaling messages."""
    auth.login()
    
    # Mock the signaling function
    with patch('routes.api.webrtc.process_signaling_message', return_value=True):
        response = client.post('/api/webrtc/signal/test-session-12345',
                              data=json.dumps({
                                  'type': 'offer',
                                  'sdp': 'mock_sdp_data'
                              }),
                              content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True

def test_invalid_signaling_message(client, auth):
    """Test handling invalid WebRTC signaling messages."""
    auth.login()
    
    # Missing required fields
    response = client.post('/api/webrtc/signal/test-session-12345',
                          data=json.dumps({
                              # Missing 'type' field
                              'sdp': 'mock_sdp_data'
                          }),
                          content_type='application/json')
    
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'error' in data

def test_complete_verification_session(client, auth):
    """Test completing a verification session."""
    auth.login(username='testadmin', password='password')  # Login as admin who can verify
    
    with patch('routes.api.webrtc.complete_verification', return_value=True):
        response = client.post('/api/webrtc/verify/test-session-12345',
                              data=json.dumps({
                                  'verified': True,
                                  'notes': 'Identity confirmed via video call'
                              }),
                              content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert 'message' in data

def test_reject_verification_session(client, auth):
    """Test rejecting a verification session."""
    auth.login(username='testadmin', password='password')  # Login as admin who can verify
    
    with patch('routes.api.webrtc.complete_verification', return_value=True):
        response = client.post('/api/webrtc/verify/test-session-12345',
                              data=json.dumps({
                                  'verified': False,
                                  'notes': 'Could not confirm identity'
                              }),
                              content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert 'message' in data

def test_unauthorized_verification(client, auth):
    """Test that regular users cannot verify sessions."""
    auth.login()  # Login as regular user
    
    response = client.post('/api/webrtc/verify/test-session-12345',
                          data=json.dumps({
                              'verified': True,
                              'notes': 'Attempt to verify'
                          }),
                          content_type='application/json')
    
    assert response.status_code == 403
    data = json.loads(response.data)
    assert 'error' in data

def test_get_ice_servers(client, auth):
    """Test retrieving ICE servers configuration."""
    auth.login()
    
    mock_ice_servers = [
        {'urls': 'stun:stun.l.google.com:19302'},
        {
            'urls': 'turn:turn.example.com:3478',
            'username': 'test',
            'credential': 'test123'
        }
    ]
    
    with patch('routes.api.webrtc.get_ice_servers', return_value=mock_ice_servers):
        response = client.get('/api/webrtc/ice-servers')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) == 2
        assert data[0]['urls'] == 'stun:stun.l.google.com:19302'
        assert 'credential' in data[1]

def test_get_active_sessions(client, auth):
    """Test retrieving active WebRTC sessions for a user."""
    auth.login()
    
    mock_sessions = [
        {
            'id': 'session-1',
            'peer_id': 2,
            'peer_name': 'Admin User',
            'status': 'active',
            'created_at': '2023-01-01T12:00:00'
        },
        {
            'id': 'session-2',
            'peer_id': 3,
            'peer_name': 'Other User',
            'status': 'pending',
            'created_at': '2023-01-02T14:30:00'
        }
    ]
    
    with patch('routes.api.webrtc.get_active_sessions', return_value=mock_sessions):
        response = client.get('/api/webrtc/sessions')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) == 2
        assert data[0]['id'] == 'session-1'
        assert data[1]['status'] == 'pending'

def test_cancel_session(client, auth):
    """Test canceling a WebRTC session."""
    auth.login()
    
    with patch('routes.api.webrtc.cancel_session', return_value=True):
        response = client.delete('/api/webrtc/session/test-session-12345')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True

def test_session_statistics(client, auth):
    """Test retrieving WebRTC session statistics."""
    auth.login(username='testadmin', password='password')  # Login as admin
    
    mock_stats = {
        'total_sessions': 150,
        'completed_sessions': 120,
        'verification_success_rate': 0.85,
        'average_duration': 450,  # seconds
        'sessions_by_day': {
            '2023-01-01': 15,
            '2023-01-02': 25,
            '2023-01-03': 30
        }
    }
    
    with patch('routes.api.webrtc.get_session_statistics', return_value=mock_stats):
        response = client.get('/api/webrtc/statistics')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['total_sessions'] == 150
        assert data['verification_success_rate'] == 0.85
        assert len(data['sessions_by_day']) == 3 