import asyncio
import sys
sys.path.insert(0, '/Users/akshay/Desktop/workspace/Evols/backend')

from app.core.database import AsyncSessionLocal
from app.services.persona_deduplication import PersonaDeduplicationService

async def test():
    async with AsyncSessionLocal() as db:
        try:
            dedup_service = PersonaDeduplicationService(db, tenant_config=None)
            
            # Test with a similar persona to existing ones
            candidate = {
                'name': 'SMB Retail',
                'description': 'Retail professionals at SMB companies',
                'segment': 'SMB',
                'persona_summary': 'Based on feedback from retail customers'
            }
            
            duplicates = await dedup_service.find_duplicates(candidate, tenant_id=3)
            
            if duplicates:
                print(f"✓ Duplicate detection working! Found {len(duplicates)} similar personas:")
                for persona, similarity in duplicates[:3]:
                    print(f"  - {persona.name} ({similarity:.2%} similar)")
            else:
                print("✗ No duplicates found (might be okay if no similar personas exist)")
                
        except Exception as e:
            print(f"ERROR: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()

asyncio.run(test())
