import unittest

from app.auth import hash_pin, verify_pin


class PinHashTests(unittest.TestCase):
    def test_correct_pin(self):
        pin_hash = hash_pin("5623")
        self.assertTrue(verify_pin(pin_hash, "5623"))
        self.assertFalse(verify_pin(pin_hash, "5624"))

    def test_distinct_salt(self):
        self.assertNotEqual(hash_pin("5623"), hash_pin("5623"))

    def test_plaintext_is_rejected(self):
        self.assertFalse(verify_pin("5623", "5623"))

    def test_short_pin_is_rejected(self):
        with self.assertRaises(ValueError):
            hash_pin("123456")

    def test_non_numeric_pin_is_rejected(self):
        with self.assertRaises(ValueError):
            hash_pin("12a4")

    def test_corrupt_hash_is_rejected(self):
        self.assertFalse(verify_pin("pbkdf2_sha256$0$zz$zz", "5623"))


if __name__ == "__main__":
    unittest.main()
