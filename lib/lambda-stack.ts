import { Fn, Stack, StackProps } from "aws-cdk-lib";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

export class LambdaStack extends Stack{
    constructor(scope: Construct, id: string, props?: StackProps){
        super(scope, id, props);

        const accountId = this.account;

        const lambdaS3Bucket = new Bucket(this, "lambdaS3Bucket",{
            bucketName: `lambda-s3-bucket-${accountId}`
        });

        const bucketLambdaDeployment = new BucketDeployment(this, "deployLambdaToBucket", {
            sources: [Source.asset("../lambda/ssg/ssg.py.gz")],
            destinationBucket: lambdaS3Bucket,
            extract: false,
            outputObjectKeys: true,
        });

        const bucketAssetDeployment = new BucketDeployment(this, "deployAssestsToBucket", {
            sources: [Source.asset("../lambda/ssg/assets")],
            destinationBucket: lambdaS3Bucket,
            extract: true,
            outputObjectKeys: true,
        });

        const lambdaFunction = new Function(this, "lambda",{
            runtime: Runtime.PYTHON_3_10,
            handler: "ssg.main",
            code: Code.fromBucketV2(
                Bucket.fromBucketName(this, "codeBucket", lambdaS3Bucket.bucketName),
                Fn.select(0, bucketLambdaDeployment.objectKeys),
            ),
        });

        lambdaFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['s3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
                resources: [lambdaS3Bucket.bucketArn],
            }),
        );

        bucketAssetDeployment.node.addDependency(lambdaS3Bucket);
        bucketLambdaDeployment.node.addDependency(lambdaS3Bucket);
        lambdaFunction.node.addDependency(bucketLambdaDeployment);

    }
}