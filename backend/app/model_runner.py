import asyncio
import os
from typing import Dict, List
from openai import OpenAI
from anthropic import Anthropic


class ModelRunner:
    def __init__(self):
        # Initialize API clients
        self.openai_client = None
        self.anthropic_client = None
        
        # Initialize clients if API keys are available
        if os.getenv('OPENAI_API_KEY'):
            self.openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        
        if os.getenv('ANTHROPIC_API_KEY'):
            self.anthropic_client = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
        
        self.models = {
            'gpt-4': self._run_gpt4,
            'gpt-3.5-turbo': self._run_gpt35,
            'claude-3': self._run_claude3,
            'bert-base': self._run_bert_placeholder,
            't5-base': self._run_t5_placeholder,
        }
    
    async def run_models(self, prompt: str, model_list: List[str]) -> Dict[str, str]:
        """Run multiple models concurrently and return results"""
        tasks = []
        for model in model_list:
            if model in self.models:
                task = self.models[model](prompt)
                tasks.append((model, task))
        
        results = {}
        for model, task in tasks:
            try:
                result = await task
                results[model] = result
            except Exception as e:
                results[model] = f"Error: {str(e)}"
        
        return results
    
    async def _run_gpt4(self, prompt: str) -> str:
        """Run GPT-4 model"""
        if not self.openai_client:
            return ("GPT-4 Error: No OpenAI API key provided. "
                    "Add OPENAI_API_KEY to your .env file to use real GPT-4.")
        
        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500,
                temperature=0.7
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"GPT-4 Error: {str(e)}"
    
    async def _run_gpt35(self, prompt: str) -> str:
        """Run GPT-3.5 Turbo model"""
        if not self.openai_client:
            return ("GPT-3.5 Turbo Error: No OpenAI API key provided. "
                    "Add OPENAI_API_KEY to your .env file to use real GPT-3.5.")
        
        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500,
                temperature=0.7
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"GPT-3.5 Turbo Error: {str(e)}"
    
    async def _run_claude3(self, prompt: str) -> str:
        """Run Claude 3 model"""
        if not self.anthropic_client:
            return ("Claude 3 Error: No Anthropic API key provided. "
                    "Add ANTHROPIC_API_KEY to your .env file to use real Claude 3.")
        
        try:
            response = self.anthropic_client.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text
        except Exception as e:
            return f"Claude 3 Error: {str(e)}"
    
    async def _run_bert_placeholder(self, prompt: str) -> str:
        """Placeholder for BERT model"""
        await asyncio.sleep(0.5)  # Simulate processing
        return (f"BERT Base response to: '{prompt[:100]}...'\n\n"
                "This is a placeholder response. To use real BERT, "
                "you would need to install transformers library and load a BERT model locally.")
    
    async def _run_t5_placeholder(self, prompt: str) -> str:
        """Placeholder for T5 model"""
        await asyncio.sleep(0.6)  # Simulate processing
        return (f"T5 Base response to: '{prompt[:100]}...'\n\n"
                "This is a placeholder response. To use real T5, "
                "you would need to install transformers library and load a T5 model locally.")


# Global instance
model_runner = ModelRunner()


async def run_models(prompt: str, model_list: List[str]) -> Dict[str, str]:
    """Main function to run models"""
    return await model_runner.run_models(prompt, model_list)
