DOMAIN_NAME = "1clickparish.com"
DEFAULT_EXCEPTION_MESSAGE = 'Your Google Account was rejected.'

def lambda_handler(event, context):
    trigger = event.get('triggerSource')
    user_attributes = event.get('request', {}).get('userAttributes', {}) or {}
    hosted_domain = user_attributes.get('custom:hd')
    if trigger != 'PreSignUp_ExternalProvider': return event
    if not hosted_domain or hosted_domain.lower() != DOMAIN_NAME.lower(): raise Exception(DEFAULT_EXCEPTION_MESSAGE)
    event['response']['autoVerifyEmail'] = True
    event['response']['autoConfirmUser'] = True
    return event