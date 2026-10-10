cat <lab>/seed.sql 2>/dev/null | head -5; echo '---'; ls <lab>/ 2>/dev/null; echo '---FIND---'; find / -name 'seed.sql' 2>/dev/null | head -5
