"""
User Model
Represents a user in the Proof of Humanity application
"""

class User:
    """User model"""
    
    def __init__(self, id=None, username=None, email=None, profile_image=None, 
                 bio=None, created_at=None, updated_at=None, is_verified=False,
                 wallet_address=None):
        """Initialize a user object"""
        self.id = id
        self.username = username
        self.email = email
        self.profile_image = profile_image 
        self.bio = bio
        self.created_at = created_at
        self.updated_at = updated_at
        self.is_verified = is_verified
        self.wallet_address = wallet_address
    
    @classmethod
    def from_db(cls, user_data):
        """Create a User instance from database row"""
        if not user_data:
            return None
            
        return cls(
            id=user_data.get('id'),
            username=user_data.get('username'),
            email=user_data.get('email'),
            profile_image=user_data.get('profile_image'),
            bio=user_data.get('bio'),
            created_at=user_data.get('created_at'),
            updated_at=user_data.get('updated_at'),
            is_verified=bool(user_data.get('is_verified')),
            wallet_address=user_data.get('wallet_address')
        )
    
    def to_dict(self):
        """Convert user object to dictionary"""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'profile_image': self.profile_image,
            'bio': self.bio,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'is_verified': self.is_verified,
            'wallet_address': self.wallet_address
        }
    
    def __repr__(self):
        """String representation of user object"""
        return f'<User {self.username}>' 