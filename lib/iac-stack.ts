import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { UserPool, UserPoolClientIdentityProvider, UserPoolIdentityProviderFacebook, UserPoolIdentityProviderGoogle } from 'aws-cdk-lib/aws-cognito';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class IacStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const pool = new UserPool(this, "UserPool", { signInCaseSensitive: false });

    const domainPrefix = `1clickparish-auth`;
    const domain = pool.addDomain("CognitoDomain", {
      cognitoDomain: { domainPrefix },
    });

    const secretGoogle = Secret.fromSecretNameV2(this, "cognitoGoogleClientSecret", "1clickparish/google").secretValue
    const secretFacebook = Secret.fromSecretNameV2(this, "cognitoFacebookClientSecret", "1clickparish/facebook").secretValue

    const googleProvider = new UserPoolIdentityProviderGoogle(this, 'Google', {
      clientId: 'google-client-id',
      userPool: pool,
      clientSecretValue: secretGoogle
    });

    const facebookProvider = new UserPoolIdentityProviderFacebook(this, 'Facebook', {
      clientId: 'facebook-client-id',
      userPool: pool,
      clientSecret: secretFacebook.toString()
    });

    const client = pool.addClient('1clickparish-app-client', {
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
    client.node.addDependency(googleProvider,facebookProvider,domain);
  }
}
