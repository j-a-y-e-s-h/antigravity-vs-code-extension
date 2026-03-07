import json
import pickle
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict


class SessionManager:
    """
    Manages browser sessions with automatic recovery.
    Handles session persistence, validation, and recovery.
    """

    def __init__(self, session_dir: str = "./sessions"):
        self.session_dir = Path(session_dir)
        self.session_dir.mkdir(exist_ok=True, parents=True)
        self.session_file = self.session_dir / "session_data.json"
        self.metadata_file = self.session_dir / "metadata.json"

    def save_session(self, chat_id: str, metadata: Optional[Dict] = None):
        """Save current session information."""
        session_data = {
            "chat_id": chat_id,
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata or {}
        }

        with open(self.session_file, 'w') as f:
            json.dump(session_data, f, indent=2)

        print(f"✓ Session saved: {chat_id}")

    def load_session(self) -> Optional[Dict]:
        """Load existing session if valid."""
        if not self.session_file.exists():
            return None

        with open(self.session_file, 'r') as f:
            session_data = json.load(f)

        # Check if session is still valid (within 24 hours)
        timestamp = datetime.fromisoformat(session_data['timestamp'])
        if datetime.now() - timestamp > timedelta(hours=24):
            print("⚠ Session expired")
            return None

        print(f"✓ Session loaded: {session_data['chat_id']}")
        return session_data

    def clear_session(self):
        """Clear saved session."""
        if self.session_file.exists():
            self.session_file.unlink()
        print("✓ Session cleared")

    def save_metadata(self, key: str, value: any):
        """Save arbitrary metadata."""
        metadata = {}
        if self.metadata_file.exists():
            with open(self.metadata_file, 'r') as f:
                metadata = json.load(f)

        metadata[key] = value
        metadata['updated'] = datetime.now().isoformat()

        with open(self.metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)

    def load_metadata(self, key: str, default: any = None) -> any:
        """Load metadata value."""
        if not self.metadata_file.exists():
            return default

        with open(self.metadata_file, 'r') as f:
            metadata = json.load(f)

        return metadata.get(key, default)
