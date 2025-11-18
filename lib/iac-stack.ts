import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { ProviderAttribute, StringAttribute, UserPool, UserPoolClientIdentityProvider, UserPoolIdentityProviderFacebook, UserPoolIdentityProviderGoogle, UserPoolOperation } from 'aws-cdk-lib/aws-cognito';
import { Runtime, Function, Code } from 'aws-cdk-lib/aws-lambda';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class IacStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    //  User Pools

    const pool1 = new UserPool(this, "Pool1", { 
      signInCaseSensitive: false,
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
        fullname: {
          required: false,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
      },
      customAttributes: {
        'websiteId': new StringAttribute( { minLen: 4, maxLen: 30, mutable: true } )
      }
    });

    const pool2 = new UserPool(this, "Pool2", { 
      signInCaseSensitive: false,
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
        fullname: {
          required: false,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
      },
      customAttributes: {
        'hd': new StringAttribute( { mutable: true } ),
      }
    });

    // Domains

    const domainPrefix = `1clickparish-auth`;
    const domain = pool1.addDomain("CognitoDomain", {
      cognitoDomain: { domainPrefix },
    });

    // Client Secrets

    const googleClientSecret1 = Secret.fromSecretNameV2(this, "cognitoGoogleClientSecret1", "1clickparish/bullfrog").secretValue
    const googleClientSecret2 = Secret.fromSecretNameV2(this, "cognitoGoogleClientSecret2", "1clickparish/toadcow").secretValue
    const facebookClientSecret = '{{resolve:secretsmanager:1clickparish/calftadpole:SecretString:clientSecret}}';

    // User Pool Identity Providers and dependencies

    const googleProvider1 = new UserPoolIdentityProviderGoogle(this, 'Google1', {
      clientId: 'google-client-id',
      userPool: pool1,
      clientSecretValue: googleClientSecret1,
      attributeMapping: {
        email: ProviderAttribute.GOOGLE_EMAIL,
        givenName: ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: ProviderAttribute.GOOGLE_FAMILY_NAME,
        fullname: ProviderAttribute.GOOGLE_NAME
      },
      scopes: ['profile', 'email', 'openid']
    });

    const googleProvider2 = new UserPoolIdentityProviderGoogle(this, 'Google2', {
      clientId: 'google-client-id',
      userPool: pool2,
      clientSecretValue: googleClientSecret2,
      attributeMapping: {
        email: ProviderAttribute.GOOGLE_EMAIL,
        givenName: ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: ProviderAttribute.GOOGLE_FAMILY_NAME,
        fullname: ProviderAttribute.GOOGLE_NAME,
        custom: {
          hd: ProviderAttribute.other('hd')
        },
      },
      scopes: ['profile', 'email', 'openid']
    });

    const facebookProvider = new UserPoolIdentityProviderFacebook(this, 'Facebook', {
      clientId: 'facebook-client-id',
      userPool: pool1,
      clientSecret: facebookClientSecret,
      attributeMapping: {
        email: ProviderAttribute.FACEBOOK_EMAIL,
        givenName: ProviderAttribute.FACEBOOK_FIRST_NAME,
        familyName: ProviderAttribute.FACEBOOK_LAST_NAME,
        fullname: ProviderAttribute.FACEBOOK_NAME
      },
      scopes: ['profile', 'email']
    });

    const client1 = pool1.addClient('1clickparish-app-client', {
      authFlows: {
        userPassword: true,
      },
      supportedIdentityProviders: [
        UserPoolClientIdentityProvider.GOOGLE,
        UserPoolClientIdentityProvider.FACEBOOK,
        UserPoolClientIdentityProvider.COGNITO,
      ],
      authSessionValidity: Duration.minutes(15),
      accessTokenValidity: Duration.minutes(60),
      idTokenValidity: Duration.minutes(60),
      refreshTokenValidity: Duration.days(30),
    });

    const client2 = pool2.addClient('1clickparish-app-client-2', {
      authFlows: {
        userPassword: false
      },
      supportedIdentityProviders: [ UserPoolClientIdentityProvider.GOOGLE ],
      authSessionValidity: Duration.minutes(15),
      accessTokenValidity: Duration.minutes(15),
      idTokenValidity: Duration.minutes(15),
      refreshTokenValidity: Duration.days(14)
    });

    client1.node.addDependency(googleProvider1, facebookProvider, domain);
    client2.node.addDependency(googleProvider2, domain);

    // Client IDs

    // const clientId = client.userPoolClientId;
    const clientId2 = client2.userPoolClientId;

    // Lambdas

    const preSignUp = new Function(this, 'PreSignUp', {
      runtime: Runtime.PYTHON_3_13,
      handler: 'index.handler',
      code: Code.fromAsset("lambda/av"),
      environment: {
        COGNITO_CLIENT_ID: clientId2
      },
    });

    // Triggers

    pool2.addTrigger(UserPoolOperation.PRE_SIGN_UP, preSignUp)

  }
}
